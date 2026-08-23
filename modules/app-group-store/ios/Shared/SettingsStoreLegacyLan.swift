import Foundation

public extension SettingsStore {
    static func loadLegacyLanConfigurationJSON() -> String? {
        for defaults in legacyLanDefaultsStores() {
            guard let configuration = legacyLanConfiguration(in: defaults),
                  JSONSerialization.isValidJSONObject(configuration),
                  let data = try? JSONSerialization.data(withJSONObject: configuration)
            else { continue }
            return String(data: data, encoding: .utf8)
        }
        return nil
    }

    private static func legacyLanDefaultsStores() -> [UserDefaults] {
        var stores: [UserDefaults] = []
        for groupID in [appGroupID] + legacyAppGroupIDs {
            if let defaults = UserDefaults(suiteName: groupID) {
                stores.append(defaults)
            }
        }
        stores.append(.standard)
        return stores
    }

    private static func legacyLanConfiguration(in defaults: UserDefaults) -> [String: Any]? {
        defaults.synchronize()
        if let list = jsonDictionary(defaults.object(forKey: "server_config_list")),
           let servers = list["configs"] as? [[String: Any]],
           !servers.isEmpty {
            let activeID = list["activeConfigId"] as? String
            let activeIndex = activeID.flatMap { id in
                servers.firstIndex { ($0["id"] as? String) == id }
            } ?? (servers.isEmpty ? -1 : 0)
            return makeLegacyLanConfiguration(
                servers: servers,
                activeServerIndex: activeIndex,
                defaults: defaults
            )
        }

        if let server = jsonDictionary(defaults.object(forKey: "server_config")) {
            return makeLegacyLanConfiguration(
                servers: [server],
                activeServerIndex: 0,
                defaults: defaults
            )
        }
        return nil
    }

    private static func makeLegacyLanConfiguration(
        servers: [[String: Any]],
        activeServerIndex: Int,
        defaults: UserDefaults
    ) -> [String: Any] {
        let appSettings = jsonDictionary(defaults.object(forKey: "app_settings"))
        return [
            "servers": servers,
            "activeServerIndex": activeServerIndex,
            "trustInsecureCert": appSettings?["trustInsecureCert"] as? Bool ?? false,
        ]
    }

    private static func jsonDictionary(_ value: Any?) -> [String: Any]? {
        if let dictionary = value as? [String: Any] {
            return dictionary
        }
        let data: Data?
        if let encoded = value as? Data {
            data = encoded
        } else if let string = value as? String {
            data = string.data(using: .utf8)
        } else {
            data = nil
        }
        guard let data,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return object
    }
}
