import { describe, expect, it } from '@jest/globals';
import { createDefaultSettings } from '../types/settings';

describe('platform settings defaults', () => {
  it('selects LAN by default on every platform', () => {
    expect(createDefaultSettings('ios').syncChannel).toBe('lan');
    expect(createDefaultSettings('android').syncChannel).toBe('lan');
  });

  it('enables automatic pull and push on iOS', () => {
    const settings = createDefaultSettings('ios');

    expect(settings.autoApplyRemote).toBe(true);
    expect(settings.autoPushLocal).toBe(true);
  });

  it('enables automatic pull and push on Android', () => {
    const settings = createDefaultSettings('android');

    expect(settings.autoApplyRemote).toBe(true);
    expect(settings.autoPushLocal).toBe(true);
  });

  it('keeps background sync available on mobile data by default', () => {
    expect(createDefaultSettings('android').backgroundSyncNetwork).toBe('any');
  });

  it('starts without a configured LAN server', () => {
    const settings = createDefaultSettings('android');

    expect(settings.lanServers).toEqual([]);
    expect(settings).not.toHaveProperty('activeLanServerId');
  });

  it('enables test updates by default in an Android Alpha installation', () => {
    expect(createDefaultSettings('android', '1.3.0.166-alpha.1').updateToBeta).toBe(true);
  });

  it('keeps test updates disabled by default in a stable Android installation', () => {
    expect(createDefaultSettings('android', '1.3.0.166').updateToBeta).toBe(false);
  });
});
