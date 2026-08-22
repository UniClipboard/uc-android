import { describe, expect, it, jest } from '@jest/globals';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function loadUnifiedSyncRuntime():
  | (new (adapters: unknown[], initialTransport: string) => {
      start(context: unknown): Promise<void>;
      sendImportedText(
        text: string,
        profileHash: string,
        options?: { targetIds?: string[] }
      ): Promise<unknown>;
      sendCurrentClipboard(): Promise<unknown>;
      sendImportedAsset(
        asset: { kind: 'image' | 'file'; uri: string; fileName?: string },
        profileHash: string,
        options?: { targetIds?: string[] }
      ): Promise<unknown>;
      observeClipboardChange(content: unknown, dispatch: boolean): Promise<unknown>;
      synchronize(): Promise<void>;
      refresh(policy: unknown): Promise<void>;
      handleAppStateChange(policy: unknown): void;
      stop(): Promise<void>;
      restart(): Promise<void>;
      switchTo(transport: string): Promise<void>;
      subscribe(listener: (event: unknown) => void): () => void;
      getSnapshot(): unknown;
    })
  | undefined {
  try {
    return require('../features/sync/internal/unifiedSyncRuntime').UnifiedSyncRuntime;
  } catch {
    return undefined;
  }
}

function loadUnifiedSyncModule():
  | {
      configureUnifiedSyncRuntime(adapters: unknown[], initialTransport: string): unknown;
      getUnifiedSyncRuntime(): unknown;
    }
  | undefined {
  try {
    return require('../features/sync/internal/unifiedSyncRuntime');
  } catch {
    return undefined;
  }
}

function adapter(id: 'lan' | 'p2p') {
  return {
    id,
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    refresh: jest.fn(async () => undefined),
    handleAppStateChange: jest.fn(),
    sendCurrentClipboard: jest.fn(async () => ({ success: true, state: 'delivered' as const })),
    sendImportedText: jest.fn(async () => ({ success: true, state: 'delivered' as const })),
    sendImportedAsset: jest.fn(async () => ({ success: true, state: 'delivered' as const })),
    observeClipboardChange: jest.fn(async () => ({ success: true, state: 'delivered' as const })),
    synchronize: jest.fn(async () => undefined),
    subscribe: jest.fn(() => jest.fn()),
  };
}

describe('UnifiedSyncRuntime', () => {
  it('starts the selected adapter and publishes a ready snapshot', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    const context = {
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    };

    await runtime.start(context);

    expect(p2p.start).toHaveBeenCalledWith(context);
    expect(runtime.getSnapshot()).toEqual({
      activeTransport: 'p2p',
      pendingTransport: null,
      status: 'ready',
      lastError: null,
      lastEvent: null,
    });
  });

  it('sends imported text through the active adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await expect(
      runtime.sendImportedText('shared text', 'TEXT_HASH', { targetIds: ['desktop-1'] })
    ).resolves.toEqual({ transport: 'p2p', success: true, state: 'delivered' });
    expect(p2p.sendImportedText).toHaveBeenCalledWith('shared text', 'TEXT_HASH', {
      targetIds: ['desktop-1'],
    });
  });

  it('stops the current adapter before activating the selected adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const lan = adapter('lan');
    const runtime = new UnifiedSyncRuntime([p2p, lan], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await runtime.switchTo('lan');

    expect(p2p.stop).toHaveBeenCalledTimes(1);
    expect(lan.start).toHaveBeenCalledTimes(1);
    expect(p2p.stop.mock.invocationCallOrder[0]).toBeLessThan(
      lan.start.mock.invocationCallOrder[0]
    );
    expect(runtime.getSnapshot()).toEqual({
      activeTransport: 'lan',
      pendingTransport: null,
      status: 'ready',
      lastError: null,
      lastEvent: null,
    });
  });

  it('keeps the current adapter active when the selected adapter fails to start', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const lan = adapter('lan');
    lan.start.mockRejectedValueOnce(new Error('LAN unavailable'));
    const runtime = new UnifiedSyncRuntime([p2p, lan], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await expect(runtime.switchTo('lan')).rejects.toThrow('LAN unavailable');

    expect(lan.stop).toHaveBeenCalledTimes(1);
    expect(p2p.start).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot()).toEqual({
      activeTransport: 'p2p',
      pendingTransport: null,
      status: 'ready',
      lastError: 'LAN unavailable',
      lastEvent: null,
    });
  });

  it('serializes concurrent switch requests', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const lan = adapter('lan');
    const lanStarted = deferred<void>();
    lan.start.mockImplementationOnce(() => lanStarted.promise);
    const runtime = new UnifiedSyncRuntime([p2p, lan], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    const switchToLan = runtime.switchTo('lan');
    const switchBackToP2p = runtime.switchTo('p2p');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lan.start).toHaveBeenCalledTimes(1);
    expect(lan.stop).not.toHaveBeenCalled();

    lanStarted.resolve();
    await Promise.all([switchToLan, switchBackToP2p]);

    expect(lan.stop).toHaveBeenCalledTimes(1);
    expect(p2p.start).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ activeTransport: 'p2p', status: 'ready' })
    );
  });

  it('ignores late events from an inactive adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const lan = adapter('lan');
    const runtime = new UnifiedSyncRuntime([p2p, lan], 'p2p');
    const received: unknown[] = [];
    runtime.subscribe((event) => received.push(event));
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });
    const staleP2pListener = p2p.subscribe.mock.calls[0]?.[0] as
      | ((event: unknown) => void)
      | undefined;

    await runtime.switchTo('lan');
    const activeLanListener = lan.subscribe.mock.calls[0]?.[0] as
      | ((event: unknown) => void)
      | undefined;
    staleP2pListener?.({ type: 'contentChanged' });
    activeLanListener?.({ type: 'connectionChanged' });

    expect(received).toEqual([{ type: 'connectionChanged' }]);
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ lastEvent: { type: 'connectionChanged' } })
    );
  });

  it('sends the current clipboard through the active adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await expect(runtime.sendCurrentClipboard()).resolves.toEqual({
      transport: 'p2p',
      success: true,
      state: 'delivered',
    });
    expect(p2p.sendCurrentClipboard).toHaveBeenCalledTimes(1);
  });

  it('sends imported assets through the active adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });
    const asset = { kind: 'file' as const, uri: 'file:///archive.zip', fileName: 'archive.zip' };

    await runtime.sendImportedAsset(asset, 'FILE_HASH', { targetIds: ['desktop-1'] });

    expect(p2p.sendImportedAsset).toHaveBeenCalledWith(asset, 'FILE_HASH', {
      targetIds: ['desktop-1'],
    });
  });

  it('refreshes the active adapter with the current runtime policy', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });
    const policy = { appState: 'background', backgroundSyncEnabled: false };

    await runtime.refresh(policy);

    expect(p2p.refresh).toHaveBeenCalledWith(policy);
  });

  it('forwards app state changes to the active adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });
    const policy = { appState: 'inactive', backgroundSyncEnabled: false };

    runtime.handleAppStateChange(policy);

    expect(p2p.handleAppStateChange).toHaveBeenCalledWith(policy);
  });

  it('stops the active adapter and returns to idle', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await runtime.stop();

    expect(p2p.stop).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ status: 'idle', pendingTransport: null })
    );
  });

  it('configures one shared runtime for every caller', () => {
    const syncModule = loadUnifiedSyncModule();
    expect(syncModule).toBeDefined();
    if (!syncModule) return;

    const runtime = syncModule.configureUnifiedSyncRuntime([adapter('p2p')], 'p2p');

    expect(syncModule.getUnifiedSyncRuntime()).toBe(runtime);
    expect(() => syncModule.configureUnifiedSyncRuntime([adapter('p2p')], 'p2p')).toThrow(
      'The unified sync runtime is already configured'
    );
  });

  it('does not restart when the selected adapter is already active', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await runtime.switchTo('p2p');

    expect(p2p.stop).not.toHaveBeenCalled();
    expect(p2p.start).toHaveBeenCalledTimes(1);
  });

  it('restarts the active adapter only when explicitly requested', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await runtime.restart();

    expect(p2p.stop).toHaveBeenCalledTimes(1);
    expect(p2p.start).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ activeTransport: 'p2p', status: 'ready' })
    );
  });

  it('rejects an initial transport without a registered adapter', () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    expect(() => new UnifiedSyncRuntime([], 'p2p')).toThrow('No sync adapter registered for p2p');
  });

  it('publishes a failed snapshot when initial startup fails', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    p2p.start.mockRejectedValueOnce(new Error('P2P startup failed'));
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');

    await expect(
      runtime.start({
        appVersion: '2.0.0+build.179',
        profileId: 'default',
        policy: { appState: 'active', backgroundSyncEnabled: true },
      })
    ).rejects.toThrow('P2P startup failed');
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ status: 'failed', lastError: 'P2P startup failed' })
    );
  });

  it('rejects sends before the active adapter is ready', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const runtime = new UnifiedSyncRuntime([adapter('p2p')], 'p2p');

    await expect(runtime.sendCurrentClipboard()).rejects.toThrow('Sync runtime is not ready');
  });

  it('rejects an unavailable target without stopping the active adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await expect(runtime.switchTo('lan')).rejects.toThrow('No sync adapter registered for lan');
    expect(p2p.stop).not.toHaveBeenCalled();
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ activeTransport: 'p2p', status: 'ready' })
    );
  });

  it('waits for initial startup when selecting the already active transport', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const started = deferred<void>();
    p2p.start.mockImplementationOnce(() => started.promise);
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    const start = runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });
    let selectionFinished = false;
    const selection = runtime.switchTo('p2p').then(() => {
      selectionFinished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(selectionFinished).toBe(false);

    started.resolve();
    await Promise.all([start, selection]);
    expect(runtime.getSnapshot()).toEqual(expect.objectContaining({ status: 'ready' }));
  });

  it('cleans up the adapter after initial startup fails', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    p2p.start.mockRejectedValueOnce(new Error('P2P startup failed'));
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');

    await expect(
      runtime.start({
        appVersion: '2.0.0+build.179',
        profileId: 'default',
        policy: { appState: 'active', backgroundSyncEnabled: true },
      })
    ).rejects.toThrow('P2P startup failed');

    expect(p2p.stop).toHaveBeenCalledTimes(1);
  });

  it('marks the runtime failed when the active adapter reports a fatal event', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });
    const listener = p2p.subscribe.mock.calls[0]?.[0] as ((event: unknown) => void) | undefined;

    listener?.({ type: 'failed', message: 'runtime:7001' });

    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ status: 'failed', lastError: 'runtime:7001' })
    );
  });

  it('marks the runtime failed when the active adapter cannot stop', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    p2p.stop.mockRejectedValueOnce(new Error('P2P stop failed'));
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await expect(runtime.stop()).rejects.toThrow('P2P stop failed');
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({ status: 'failed', lastError: 'P2P stop failed' })
    );
  });

  it('marks the runtime failed when switch rollback cannot restart the previous adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const lan = adapter('lan');
    lan.start.mockRejectedValueOnce(new Error('LAN unavailable'));
    p2p.start
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('P2P rollback failed'));
    const runtime = new UnifiedSyncRuntime([p2p, lan], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await expect(runtime.switchTo('lan')).rejects.toThrow('LAN unavailable');
    expect(runtime.getSnapshot()).toEqual(
      expect.objectContaining({
        activeTransport: 'p2p',
        status: 'failed',
        lastError: 'LAN unavailable; rollback failed: P2P rollback failed',
      })
    );
  });

  it('routes automatic clipboard observations through the active adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });
    const content = { type: 'Text', text: 'captured', profileHash: 'TEXT_HASH' };

    await expect(runtime.observeClipboardChange(content, true)).resolves.toEqual({
      transport: 'p2p',
      success: true,
      state: 'delivered',
    });
    expect(p2p.observeClipboardChange).toHaveBeenCalledWith(content, true);
  });

  it('synchronizes through the active adapter', async () => {
    const UnifiedSyncRuntime = loadUnifiedSyncRuntime();
    expect(UnifiedSyncRuntime).toBeDefined();
    if (!UnifiedSyncRuntime) return;

    const p2p = adapter('p2p');
    const runtime = new UnifiedSyncRuntime([p2p], 'p2p');
    await runtime.start({
      appVersion: '2.0.0+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: true },
    });

    await runtime.synchronize();

    expect(p2p.synchronize).toHaveBeenCalledTimes(1);
  });
});
