import { describe, expect, it, jest } from '@jest/globals';

function loadAdapter():
  | (new (dependencies: unknown) => {
      start(context: unknown): Promise<void>;
      stop(): Promise<void>;
      sendImportedText(text: string, profileHash: string): Promise<unknown>;
      observeClipboardChange(content: unknown, dispatch: boolean): Promise<unknown>;
    })
  | undefined {
  try {
    return require('../features/lan-sync/internal/lanSyncAdapter').LanSyncAdapter;
  } catch {
    return undefined;
  }
}

const profile = {
  name: 'Desk',
  urls: ['http://desk.local:42720'],
  username: 'mobile',
  password: 'secret',
  allowInsecureTls: false,
};

describe('LanSyncAdapter', () => {
  it('pulls and applies a new remote text during startup', async () => {
    const LanSyncAdapter = loadAdapter();
    expect(LanSyncAdapter).toBeDefined();
    if (!LanSyncAdapter) return;
    const applyRemoteText = jest.fn(async () => undefined);
    const client = {
      getClipboard: jest.fn(async () => ({
        url: profile.urls[0],
        document: {
          type: 'Text',
          hash: 'REMOTE_HASH',
          contentId: 'blake3v1:remote',
          text: 'from desktop',
          hasData: false,
          size: 12,
        },
      })),
      putClipboard: jest.fn(async () => ({ url: profile.urls[0] })),
    };
    const adapter = new LanSyncAdapter({
      getActiveServer: async () => profile,
      readClipboard: async () => null,
      applyRemoteText,
      client,
    });

    await adapter.start({
      appVersion: '2.0.0',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: false },
    });

    expect(applyRemoteText).toHaveBeenCalledWith({
      text: 'from desktop',
      profileHash: 'REMOTE_HASH',
      contentId: 'blake3v1:remote',
      size: 12,
    });
    await adapter.stop();
  });

  it('uploads short imported and observed text without dispatching disabled observations', async () => {
    const LanSyncAdapter = loadAdapter();
    expect(LanSyncAdapter).toBeDefined();
    if (!LanSyncAdapter) return;
    const client = {
      getClipboard: jest.fn(async () => null),
      putClipboard: jest.fn(async () => ({ url: profile.urls[0] })),
    };
    const adapter = new LanSyncAdapter({
      getActiveServer: async () => profile,
      readClipboard: async () => null,
      applyRemoteText: async () => undefined,
      client,
    });
    await adapter.start({
      appVersion: '2.0.0',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: false },
    });

    await expect(adapter.sendImportedText('from phone', 'LOCAL_HASH')).resolves.toEqual({
      success: true,
      state: 'delivered',
      counts: { accepted: 1, duplicate: 0, offline: 0, errored: 0, pending: 0 },
    });
    await expect(
      adapter.observeClipboardChange(
        { type: 'Text', text: 'observed', profileHash: 'OBSERVED_HASH' },
        false
      )
    ).resolves.toBeNull();
    await adapter.observeClipboardChange(
      { type: 'Text', text: 'observed', profileHash: 'OBSERVED_HASH' },
      true
    );

    expect(client.putClipboard).toHaveBeenNthCalledWith(1, profile, {
      type: 'Text',
      hash: 'LOCAL_HASH',
      text: 'from phone',
      hasData: false,
      size: 10,
    });
    expect(client.putClipboard).toHaveBeenNthCalledWith(2, profile, {
      type: 'Text',
      hash: 'OBSERVED_HASH',
      text: 'observed',
      hasData: false,
      size: 8,
    });
    await adapter.stop();
  });
});
