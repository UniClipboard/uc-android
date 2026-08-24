import Foundation
internal import UcEngineCore

enum KeyboardLanSyncError: LocalizedError {
    case notConfigured
    case missingPassword
    case invalidURL
    case unavailable
    case authenticationFailed
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "No LAN server is configured."
        case .missingPassword: return "The LAN server password is unavailable."
        case .invalidURL: return "The LAN server address is invalid."
        case .unavailable: return "The LAN server is unavailable."
        case .authenticationFailed: return "The LAN server rejected the credentials."
        case .invalidResponse: return "The LAN server returned an invalid response."
        }
    }
}

@MainActor
final class KeyboardLanSyncTransport: KeyboardSyncTransport {
    let channel = SyncChannel.lan

    private struct Configuration: Equatable {
        let server: LanServerProfile
        let password: String
    }

    private let store: SettingsStore
    private lazy var history = HistoryLog(store: store)
    private var configurations: [Configuration] = []
    private var clients: [String: KeyboardLanHttpClient] = [:]
    private var lastSeenRemoteIdentity: [String: String] = [:]

    init(store: SettingsStore) {
        self.store = store
    }

    func synchronize(_ snapshot: DeviceClipboardSnapshot?) async throws -> KeyboardSyncResult {
        let currentClients = try currentClients()
        var delivery: ExtensionDeliveryReport?
        if let snapshot {
            var accepted: UInt64 = 0
            var offline: UInt64 = 0
            var errored: UInt64 = 0
            for (_, client) in currentClients {
                do {
                    try await client.publish(snapshot)
                    accepted += 1
                } catch KeyboardLanSyncError.unavailable {
                    offline += 1
                } catch {
                    errored += 1
                }
            }
            delivery = ExtensionDeliveryReport(
                entryId: snapshot.clipboard.contentId ?? snapshot.clipboard.hash ?? UUID().uuidString,
                accepted: accepted,
                duplicate: 0,
                offline: offline,
                errored: errored,
                pending: 0
            )
        }
        let remote = try await pullRemote(using: currentClients, outgoing: snapshot?.clipboard)
        return KeyboardSyncResult(remoteChange: remote.map(KeyboardRemoteChange.snapshot), delivery: delivery)
    }

    func waitForRemoteChange(timeoutMs: UInt64) async throws -> KeyboardRemoteChange? {
        try await Task.sleep(nanoseconds: timeoutMs * 1_000_000)
        try Task.checkCancellation()
        let remote = try await pullRemote(using: currentClients(), outgoing: nil)
        return remote.map(KeyboardRemoteChange.snapshot)
    }

    func stop() {
        clients.values.forEach { $0.stop() }
        clients = [:]
        configurations = []
        lastSeenRemoteIdentity = [:]
    }

    private func currentClients() throws -> [(String, KeyboardLanHttpClient)] {
        let settings = store.loadAppSettings()
        guard settings.syncChannel == .lan, !settings.lanServers.isEmpty else {
            throw KeyboardLanSyncError.notConfigured
        }
        let nextConfigurations = try settings.lanServers.compactMap { server -> Configuration? in
            guard let password = try LanServerCredentialStore.password(serverId: server.id),
                  !password.isEmpty else { return nil }
            return Configuration(server: server, password: password)
        }
        guard !nextConfigurations.isEmpty else { throw KeyboardLanSyncError.missingPassword }
        if configurations != nextConfigurations {
            clients.values.forEach { $0.stop() }
            clients = Dictionary(uniqueKeysWithValues: try nextConfigurations.map { configuration in
                (
                    configuration.server.id,
                    try KeyboardLanHttpClient(
                        server: configuration.server,
                        password: configuration.password
                    )
                )
            })
            configurations = nextConfigurations
            lastSeenRemoteIdentity = [:]
        }
        return settings.lanServers.compactMap { server in
            clients[server.id].map { (server.id, $0) }
        }
    }

    private func pullRemote(
        using clients: [(String, KeyboardLanHttpClient)],
        outgoing: Clipboard?
    ) async throws -> DeviceClipboardSnapshot? {
        for (serverId, client) in clients {
            guard let remote = try? await client.pull() else { continue }
            let identity = Self.identity(remote.clipboard)
            if identity == lastSeenRemoteIdentity[serverId] { continue }
            lastSeenRemoteIdentity[serverId] = identity
            if let outgoing, Self.sameContent(remote.clipboard, outgoing) { continue }
            if let hash = remote.clipboard.hash,
               history.headHash()?.caseInsensitiveCompare(hash) == .orderedSame {
                continue
            }
            return remote
        }
        return nil
    }

    private static func identity(_ clipboard: Clipboard) -> String {
        clipboard.contentId ?? clipboard.hash ?? "\(clipboard.type.rawValue):\(clipboard.text)"
    }

    private static func sameContent(_ lhs: Clipboard, _ rhs: Clipboard) -> Bool {
        if let left = lhs.contentId, let right = rhs.contentId, left == right { return true }
        if let left = lhs.hash, let right = rhs.hash,
           left.caseInsensitiveCompare(right) == .orderedSame { return true }
        return lhs.type == rhs.type
            && lhs.text == rhs.text
            && lhs.dataName == rhs.dataName
            && lhs.size == rhs.size
    }
}

private final class KeyboardLanHttpClient: @unchecked Sendable {
    private let server: LanServerProfile
    private let authorization: String
    private let session: URLSession

    init(server: LanServerProfile, password: String) throws {
        let urls = try server.urls.map(Self.normalizedBaseURL)
        guard !urls.isEmpty else { throw KeyboardLanSyncError.invalidURL }
        self.server = LanServerProfile(
            id: server.id,
            name: server.name,
            urls: urls.map(\.absoluteString),
            username: server.username,
            allowInsecureTls: server.allowInsecureTls
        )
        authorization = "Basic " + Data("\(server.username):\(password)".utf8).base64EncodedString()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 5 * 60
        session = URLSession(
            configuration: configuration,
            delegate: server.allowInsecureTls ? KeyboardLanTrustDelegate() : nil,
            delegateQueue: nil
        )
    }

    func publish(_ snapshot: DeviceClipboardSnapshot) async throws {
        try await withCandidate { baseURL in
            if snapshot.clipboard.hasData,
               let dataName = snapshot.clipboard.dataName,
               let payload = snapshot.payload {
                try await self.put(payload, name: dataName, baseURL: baseURL)
            }
            var request = URLRequest(url: baseURL.appendingPathComponent("SyncClipboard.json"))
            request.httpMethod = "PUT"
            request.setValue(self.authorization, forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(snapshot.clipboard)
            _ = try await self.perform(request)
        }
    }

    func pull() async throws -> DeviceClipboardSnapshot? {
        try await withCandidate { baseURL in
            var request = URLRequest(url: baseURL.appendingPathComponent("SyncClipboard.json"))
            request.httpMethod = "GET"
            request.setValue(self.authorization, forHTTPHeaderField: "Authorization")
            let (data, response) = try await self.session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            if status == 404 { return nil }
            try self.validate(status: status)
            guard let clipboard = try? JSONDecoder().decode(Clipboard.self, from: data) else {
                throw KeyboardLanSyncError.invalidResponse
            }
            let payload: Data?
            if clipboard.hasData, let dataName = clipboard.dataName {
                payload = try await self.getFile(name: dataName, baseURL: baseURL)
            } else {
                payload = nil
            }
            return DeviceClipboardSnapshot(clipboard: clipboard, payload: payload)
        }
    }

    func stop() {
        session.invalidateAndCancel()
    }

    private func withCandidate<T: Sendable>(
        _ operation: (URL) async throws -> T
    ) async throws -> T {
        var lastError: Error = KeyboardLanSyncError.unavailable
        for rawURL in server.urls {
            guard let baseURL = URL(string: rawURL) else { continue }
            do {
                return try await operation(baseURL)
            } catch KeyboardLanSyncError.authenticationFailed {
                throw KeyboardLanSyncError.authenticationFailed
            } catch {
                lastError = error
            }
        }
        throw lastError
    }

    private func put(_ data: Data, name: String, baseURL: URL) async throws {
        guard !name.isEmpty, !name.contains("/"), !name.contains("\\") else {
            throw KeyboardLanSyncError.invalidResponse
        }
        var request = URLRequest(url: baseURL.appendingPathComponent("file").appendingPathComponent(name))
        request.httpMethod = "PUT"
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        request.setValue("application/octet-stream", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        _ = try await perform(request)
    }

    private func getFile(name: String, baseURL: URL) async throws -> Data {
        guard !name.isEmpty, !name.contains("/"), !name.contains("\\") else {
            throw KeyboardLanSyncError.invalidResponse
        }
        var request = URLRequest(url: baseURL.appendingPathComponent("file").appendingPathComponent(name))
        request.httpMethod = "GET"
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        return try await perform(request)
    }

    private func perform(_ request: URLRequest) async throws -> Data {
        do {
            let (data, response) = try await session.data(for: request)
            try validate(status: (response as? HTTPURLResponse)?.statusCode ?? -1)
            return data
        } catch let error as KeyboardLanSyncError {
            throw error
        } catch {
            throw KeyboardLanSyncError.unavailable
        }
    }

    private func validate(status: Int) throws {
        switch status {
        case 200...299: return
        case 401, 403: throw KeyboardLanSyncError.authenticationFailed
        default: throw KeyboardLanSyncError.unavailable
        }
    }

    private static func normalizedBaseURL(_ raw: String) throws -> URL {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let value = trimmed.hasSuffix("/") ? trimmed : trimmed + "/"
        guard let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              (scheme == "http" || scheme == "https"),
              url.host?.isEmpty == false else {
            throw KeyboardLanSyncError.invalidURL
        }
        return url
    }
}

private final class KeyboardLanTrustDelegate: NSObject, URLSessionDelegate, @unchecked Sendable {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @Sendable @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let trust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}
