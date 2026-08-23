import Foundation
import Testing
@testable import OutboundShareHandoffCore

@Suite(.serialized)
struct LegacyContainerMigratorTests {
    @Test
    func testPartialCopyFailureDoesNotWriteSentinelAndRetryCompletes() throws {
        let fixture = try Fixture()
        defer { fixture.cleanup() }
        try Data("first".utf8).write(to: fixture.source.appendingPathComponent("first.txt"))
        try Data("second".utf8).write(to: fixture.source.appendingPathComponent("second.txt"))

        let fileManager = FileManager.default
        let hooks = LegacyContainerMigrationHooks(copyItem: { source, destination in
            if source.lastPathComponent == "second.txt" {
                throw CocoaError(.fileWriteUnknown)
            }
            try fileManager.copyItem(at: source, to: destination)
        })

        #expect(throws: (any Error).self) {
            _ = try LegacyContainerMigrator.migrate(
                sourceDirectory: fixture.source,
                destinationDirectory: fixture.destination,
                sourceDefaults: fixture.sourceDefaults,
                destinationDefaults: fixture.destinationDefaults,
                defaultsKeys: [],
                excludedFilenames: [],
                sentinelFilename: fixture.sentinel,
                hooks: hooks
            )
        }
        #expect(!fixture.sentinelExists)
        #expect(fixture.destinationFileExists("first.txt"))
        #expect(!fixture.destinationFileExists("second.txt"))

        let result = try fixture.migrate(defaultsKeys: [])
        #expect(result.migrated)
        #expect(fixture.destinationFileExists("first.txt"))
        #expect(fixture.destinationFileExists("second.txt"))
        #expect(fixture.sentinelExists)
    }

    @Test
    func testDefaultsFailureDoesNotWriteSentinelAndRetryCompletes() throws {
        let fixture = try Fixture()
        defer { fixture.cleanup() }
        fixture.sourceDefaults.set("value", forKey: "legacy-key")
        let hooks = LegacyContainerMigrationHooks(
            synchronizeDefaults: { _ in false }
        )

        #expect(throws: (any Error).self) {
            _ = try LegacyContainerMigrator.migrate(
                sourceDirectory: fixture.source,
                destinationDirectory: fixture.destination,
                sourceDefaults: fixture.sourceDefaults,
                destinationDefaults: fixture.destinationDefaults,
                defaultsKeys: ["legacy-key"],
                excludedFilenames: [],
                sentinelFilename: fixture.sentinel,
                hooks: hooks
            )
        }
        #expect(!fixture.sentinelExists)
        #expect(fixture.destinationDefaults.object(forKey: "legacy-key") == nil)

        _ = try fixture.migrate(defaultsKeys: ["legacy-key"])
        #expect(fixture.destinationDefaults.string(forKey: "legacy-key") == "value")
        #expect(fixture.sentinelExists)
    }

    @Test
    func testPartiallyPopulatedDestinationRetriesRemainingStandardDefaults() throws {
        let fixture = try Fixture()
        defer { fixture.cleanup() }
        fixture.sourceDefaults.set("stale-a", forKey: "a")
        fixture.sourceDefaults.set("source-b", forKey: "b")
        fixture.destinationDefaults.set("current-a", forKey: "a")

        let migrated = try LegacyDefaultsMigrator.migrate(
            source: fixture.sourceDefaults,
            destination: fixture.destinationDefaults,
            keys: ["a", "b"],
            removeSourceAfterCopy: true
        )

        #expect(migrated == 1)
        #expect(fixture.destinationDefaults.string(forKey: "a") == "current-a")
        #expect(fixture.destinationDefaults.string(forKey: "b") == "source-b")
        #expect(fixture.sourceDefaults.string(forKey: "a") == "stale-a")
        #expect(fixture.sourceDefaults.object(forKey: "b") == nil)
    }

    @Test
    func testLegacyLanCleanupPropagatesFileRemovalFailure() throws {
        let fixture = try Fixture()
        defer { fixture.cleanup() }
        let legacyFile = fixture.source.appendingPathComponent("legacy-state")
        try Data("state".utf8).write(to: legacyFile)
        let hooks = LegacyLanCleanupHooks(removeItem: { _ in
            throw CocoaError(.fileWriteUnknown)
        })

        #expect(throws: (any Error).self) {
            try LegacyLanCleaner.clean(
                defaultsStores: [],
                defaultsKeys: [],
                containerDirectories: [fixture.source],
                filenames: ["legacy-state"],
                hooks: hooks
            )
        }
        #expect(FileManager.default.fileExists(atPath: legacyFile.path))
    }
}

private final class Fixture {
    let root: URL
    let source: URL
    let destination: URL
    let sourceDefaults: UserDefaults
    let destinationDefaults: UserDefaults
    let sourceSuite: String
    let destinationSuite: String
    let sentinel = ".migration-complete"

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("LegacyContainerMigratorTests-\(UUID().uuidString)")
        source = root.appendingPathComponent("source", isDirectory: true)
        destination = root.appendingPathComponent("destination", isDirectory: true)
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        sourceSuite = "LegacyContainerMigratorTests.source.\(UUID().uuidString)"
        destinationSuite = "LegacyContainerMigratorTests.destination.\(UUID().uuidString)"
        sourceDefaults = UserDefaults(suiteName: sourceSuite)!
        destinationDefaults = UserDefaults(suiteName: destinationSuite)!
        sourceDefaults.removePersistentDomain(forName: sourceSuite)
        destinationDefaults.removePersistentDomain(forName: destinationSuite)
    }

    var sentinelExists: Bool {
        FileManager.default.fileExists(
            atPath: destination.appendingPathComponent(sentinel).path
        )
    }

    func destinationFileExists(_ name: String) -> Bool {
        FileManager.default.fileExists(atPath: destination.appendingPathComponent(name).path)
    }

    func migrate(defaultsKeys: [String]) throws -> LegacyContainerMigrationResult {
        try LegacyContainerMigrator.migrate(
            sourceDirectory: source,
            destinationDirectory: destination,
            sourceDefaults: sourceDefaults,
            destinationDefaults: destinationDefaults,
            defaultsKeys: defaultsKeys,
            excludedFilenames: [],
            sentinelFilename: sentinel
        )
    }

    func cleanup() {
        sourceDefaults.removePersistentDomain(forName: sourceSuite)
        destinationDefaults.removePersistentDomain(forName: destinationSuite)
        try? FileManager.default.removeItem(at: root)
    }
}
