import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('iOS legacy App Group migration safety', () => {
  it('delegates to a throwing migrator and never suppresses copy or sentinel failures', () => {
    const source = read('modules/app-group-store/ios/Shared/SettingsStoreLegacyMigration.swift');

    expect(source).toContain('try LegacyContainerMigrator.migrate');
    expect(source).toContain('.app_group_store_migrated_v2');
    expect(source).not.toContain('try? Data().write(to: sentinel');
    expect(source).not.toMatch(/catch\s*\{\s*continue\s*\}/);
    expect(source).not.toContain('clearLegacyLanConfiguration()');
  });

  it('ships executable native tests for partial-copy retry behavior', () => {
    const packageSource = read('modules/app-group-store/Package.swift');
    const tests = read('modules/app-group-store/ios/Tests/LegacyContainerMigratorTests.swift');

    expect(packageSource).toContain('LegacyContainerMigrator.swift');
    expect(tests).toContain('testPartialCopyFailureDoesNotWriteSentinelAndRetryCompletes');
    expect(tests).toContain('testDefaultsFailureDoesNotWriteSentinelAndRetryCompletes');
    expect(tests).toContain('testPartiallyPopulatedDestinationRetriesRemainingStandardDefaults');
    expect(tests).toContain('testLegacyLanCleanupPropagatesFileRemovalFailure');
  });

  it('continues the standard-defaults migration when one destination key already exists', () => {
    for (const relativePath of [
      'modules/app-group-store/ios/Shared/SettingsStore.swift',
      'targets/_shared/SettingsStore.swift',
    ]) {
      const source = read(relativePath);
      expect(source).toContain('try LegacyDefaultsMigrator.migrate');
      expect(source).not.toMatch(
        /for key in keys where suite\.object\(forKey: key\) != nil \{\s*return/
      );
    }
  });

  it('propagates legacy LAN cleanup failures so the JS journal can retry them', () => {
    const store = read('modules/app-group-store/ios/Shared/SettingsStore.swift');
    const nativeModule = read('modules/app-group-store/ios/AppGroupStoreModule.swift');

    expect(store).toContain('public static func clearLegacyLanConfiguration() throws');
    expect(store).toContain('try LegacyLanCleaner.clean');
    expect(store).not.toContain('try? fileManager.removeItem');
    expect(nativeModule).toContain(
      'AsyncFunction("clearLegacyLanConfiguration") { () throws -> Void in'
    );
  });
});
