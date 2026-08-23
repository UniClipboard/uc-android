import Foundation

struct LegacyContainerMigrationHooks {
    var copyItem: ((URL, URL) throws -> Void)?
    var synchronizeDefaults: ((UserDefaults) -> Bool)?
    var writeSentinel: ((URL) throws -> Void)?
}

struct LegacyLanCleanupHooks {
    var removeItem: ((URL) throws -> Void)?
    var synchronizeDefaults: ((UserDefaults) -> Bool)?
}

struct LegacyContainerMigrationResult {
    let migrated: Bool
    let keys: Int
}

enum LegacyContainerMigrationError: Error {
    case defaultsWriteFailed(String)
}

enum LegacyLanCleaner {
    static func clean(
        defaultsStores: [UserDefaults],
        defaultsKeys: [String],
        containerDirectories: [URL],
        filenames: [String],
        fileManager: FileManager = .default,
        hooks: LegacyLanCleanupHooks = .init()
    ) throws {
        for store in defaultsStores {
            for key in defaultsKeys {
                store.removeObject(forKey: key)
            }
            let synchronized = hooks.synchronizeDefaults?(store) ?? store.synchronize()
            guard synchronized else {
                throw LegacyContainerMigrationError.defaultsWriteFailed(defaultsKeys.first ?? "")
            }
        }

        for container in containerDirectories {
            for filename in filenames {
                let file = container.appendingPathComponent(filename, isDirectory: false)
                guard fileManager.fileExists(atPath: file.path) else { continue }
                if let removeItem = hooks.removeItem {
                    try removeItem(file)
                } else {
                    try fileManager.removeItem(at: file)
                }
            }
        }
    }
}

enum LegacyDefaultsMigrator {
    static func migrate(
        source: UserDefaults,
        destination: UserDefaults,
        keys: [String],
        removeSourceAfterCopy: Bool,
        hooks: LegacyContainerMigrationHooks = .init()
    ) throws -> Int {
        var copied = 0
        for key in keys {
            guard destination.object(forKey: key) == nil,
                  let value = source.object(forKey: key)
            else { continue }
            destination.set(value, forKey: key)
            let synchronized = hooks.synchronizeDefaults?(destination)
                ?? destination.synchronize()
            guard synchronized else {
                destination.removeObject(forKey: key)
                throw LegacyContainerMigrationError.defaultsWriteFailed(key)
            }
            if removeSourceAfterCopy {
                source.removeObject(forKey: key)
                _ = source.synchronize()
            }
            copied += 1
        }
        return copied
    }
}

enum LegacyContainerMigrator {
    static func migrate(
        sourceDirectory: URL?,
        destinationDirectory: URL,
        sourceDefaults: UserDefaults?,
        destinationDefaults: UserDefaults?,
        defaultsKeys: [String],
        excludedFilenames: Set<String>,
        sentinelFilename: String,
        fileManager: FileManager = .default,
        hooks: LegacyContainerMigrationHooks = .init()
    ) throws -> LegacyContainerMigrationResult {
        let sentinel = destinationDirectory.appendingPathComponent(sentinelFilename)
        if fileManager.fileExists(atPath: sentinel.path) {
            return LegacyContainerMigrationResult(migrated: false, keys: 0)
        }

        try fileManager.createDirectory(
            at: destinationDirectory,
            withIntermediateDirectories: true
        )

        var copied = 0
        if let sourceDirectory,
           sourceDirectory.standardizedFileURL != destinationDirectory.standardizedFileURL {
            copied += try copyMissingItems(
                from: sourceDirectory,
                to: destinationDirectory,
                excludedFilenames: excludedFilenames,
                fileManager: fileManager,
                hooks: hooks
            )
        }

        if let sourceDefaults, let destinationDefaults {
            copied += try LegacyDefaultsMigrator.migrate(
                source: sourceDefaults,
                destination: destinationDefaults,
                keys: defaultsKeys,
                removeSourceAfterCopy: false,
                hooks: hooks
            )
        }

        if let writeSentinel = hooks.writeSentinel {
            try writeSentinel(sentinel)
        } else {
            try Data().write(to: sentinel, options: [.atomic])
        }

        return LegacyContainerMigrationResult(migrated: copied > 0, keys: copied)
    }

    private static func copyMissingItems(
        from sourceDirectory: URL,
        to destinationDirectory: URL,
        excludedFilenames: Set<String>,
        fileManager: FileManager,
        hooks: LegacyContainerMigrationHooks
    ) throws -> Int {
        let contents = try fileManager.contentsOfDirectory(
            at: sourceDirectory,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )
        try fileManager.createDirectory(
            at: destinationDirectory,
            withIntermediateDirectories: true
        )

        var copied = 0
        for source in contents {
            if excludedFilenames.contains(source.lastPathComponent) { continue }
            let destination = destinationDirectory.appendingPathComponent(source.lastPathComponent)
            let isDirectory = try source.resourceValues(forKeys: [.isDirectoryKey]).isDirectory == true

            if isDirectory {
                copied += try copyMissingItems(
                    from: source,
                    to: destination,
                    excludedFilenames: excludedFilenames,
                    fileManager: fileManager,
                    hooks: hooks
                )
                continue
            }
            if fileManager.fileExists(atPath: destination.path) { continue }

            let temporary = destinationDirectory.appendingPathComponent(
                ".\(source.lastPathComponent).\(UUID().uuidString).migrating"
            )
            defer { try? fileManager.removeItem(at: temporary) }
            if let copyItem = hooks.copyItem {
                try copyItem(source, temporary)
            } else {
                try fileManager.copyItem(at: source, to: temporary)
            }
            do {
                try fileManager.moveItem(at: temporary, to: destination)
            } catch where fileManager.fileExists(atPath: destination.path) {
                // A concurrent migration completed the same missing item.
            }
            copied += 1
        }
        return copied
    }
}
