import Foundation

public extension SettingsStore {
    static let legacyAppGroupID = "group.app.uniclipboard.ios"

    private static var legacyMigrationSentinel: String {
        ".app_group_store_migrated_v2"
    }

    static func migrateLegacyContainer() throws -> (migrated: Bool, keys: Int) {
        let fm = FileManager.default
        guard let newURL = fm.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else {
            return (false, 0)
        }

        let result = try LegacyContainerMigrator.migrate(
            sourceDirectory: fm.containerURL(
                forSecurityApplicationGroupIdentifier: legacyAppGroupID
            ),
            destinationDirectory: newURL,
            sourceDefaults: UserDefaults(suiteName: legacyAppGroupID),
            destinationDefaults: UserDefaults(suiteName: appGroupID),
            defaultsKeys: legacyMigrationKeys,
            excludedFilenames: Set(SettingsStore.legacyLanFilenames),
            sentinelFilename: legacyMigrationSentinel,
            fileManager: fm
        )
        return (result.migrated, result.keys)
    }

    private static var legacyMigrationKeys: [String] {
        [
            AppSettings.PersistenceKey.appSettings,
            AppSettings.PersistenceKey.clipboardHistory,
            AppSettings.PersistenceKey.keyboardExtensionEnabled,
            AppSettings.PersistenceKey.keyboardExtensionFullAccess,
            AppSettings.PersistenceKey.lastSyncedChangeCount,
        ]
    }
}
