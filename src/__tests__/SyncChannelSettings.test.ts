import { describe, expect, it } from '@jest/globals';
import { migrateStoredSettings } from '../features/settings/internal/migrateStoredSettings';
import { SETTINGS_SCHEMA_VERSION } from '../types/settings';

describe('explicit sync channel settings', () => {
  it('keeps a v5 LAN install on LAN when the channel was not stored yet', () => {
    expect(migrateStoredSettings({}, 5).syncChannel).toBe('lan');
  });

  it('keeps a P2P-only install on P2P when the channel was not stored', () => {
    expect(migrateStoredSettings({}, SETTINGS_SCHEMA_VERSION - 1).syncChannel).toBe('p2p');
  });

  it('recovers an existing LAN selection from its saved server profiles', () => {
    expect(
      migrateStoredSettings(
        {
          lanServers: [
            {
              id: 'home',
              name: 'Home',
              urls: ['http://192.168.1.8:5033'],
              username: 'mobile',
              allowInsecureTls: false,
            },
          ],
        },
        SETTINGS_SCHEMA_VERSION
      ).syncChannel
    ).toBe('lan');
  });

  it.each(['lan', 'p2p'] as const)('preserves an explicit %s selection', (syncChannel) => {
    expect(migrateStoredSettings({ syncChannel }, SETTINGS_SCHEMA_VERSION - 1).syncChannel).toBe(
      syncChannel
    );
  });

  it('does not silently move an existing P2P user to LAN for an invalid channel', () => {
    expect(
      migrateStoredSettings({ syncChannel: 'automatic' }, SETTINGS_SCHEMA_VERSION).syncChannel
    ).toBe('p2p');
  });
});
