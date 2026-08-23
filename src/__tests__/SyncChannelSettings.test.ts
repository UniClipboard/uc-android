import { describe, expect, it } from '@jest/globals';
import { migrateStoredSettings } from '../features/settings/internal/migrateStoredSettings';
import { SETTINGS_SCHEMA_VERSION } from '../types/settings';

describe('explicit sync channel settings', () => {
  it('migrates a missing channel to LAN', () => {
    expect(migrateStoredSettings({}, SETTINGS_SCHEMA_VERSION - 1).syncChannel).toBe('lan');
  });

  it.each(['lan', 'p2p'] as const)('preserves an explicit %s selection', (syncChannel) => {
    expect(migrateStoredSettings({ syncChannel }, SETTINGS_SCHEMA_VERSION - 1).syncChannel).toBe(
      syncChannel
    );
  });

  it('replaces an invalid channel with LAN', () => {
    expect(
      migrateStoredSettings({ syncChannel: 'automatic' }, SETTINGS_SCHEMA_VERSION).syncChannel
    ).toBe('lan');
  });
});
