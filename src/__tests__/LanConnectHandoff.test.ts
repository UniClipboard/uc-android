import { describe, expect, it, jest } from '@jest/globals';

function loadHandoff():
  | {
      usePendingLanConnectStore: {
        getState(): {
          intent: unknown;
          set(intent: unknown): void;
          consume(): unknown;
          clear(): void;
        };
      };
      useLanQrScannerStore: {
        getState(): {
          isVisible: boolean;
          open(onScanned: (intent: unknown) => void): void;
          complete(intent: unknown): void;
          close(): void;
        };
      };
    }
  | undefined {
  try {
    return require('../features/lan-servers/handoff');
  } catch {
    return undefined;
  }
}

describe('LAN connection handoff', () => {
  it('consumes deep-link credentials exactly once', () => {
    const handoff = loadHandoff();
    expect(handoff).toBeDefined();
    if (!handoff) return;
    const intent = {
      urls: ['http://home.local:42720'],
      username: 'user',
      password: 'secret',
    };

    handoff.usePendingLanConnectStore.getState().set(intent);

    expect(handoff.usePendingLanConnectStore.getState().consume()).toEqual(intent);
    expect(handoff.usePendingLanConnectStore.getState().consume()).toBeNull();
  });

  it('delivers scanned credentials to the requester and clears the callback', () => {
    const handoff = loadHandoff();
    expect(handoff).toBeDefined();
    if (!handoff) return;
    const onScanned = jest.fn();
    const intent = {
      urls: ['https://home.example.com'],
      username: 'user',
      password: 'secret',
    };

    handoff.useLanQrScannerStore.getState().open(onScanned);
    expect(handoff.useLanQrScannerStore.getState().isVisible).toBe(true);
    handoff.useLanQrScannerStore.getState().complete(intent);

    expect(onScanned).toHaveBeenCalledWith(intent);
    expect(handoff.useLanQrScannerStore.getState().isVisible).toBe(false);
    handoff.useLanQrScannerStore.getState().complete(intent);
    expect(onScanned).toHaveBeenCalledTimes(1);
  });

  it('clears the scanner callback when the user cancels', () => {
    const handoff = loadHandoff();
    expect(handoff).toBeDefined();
    if (!handoff) return;
    const onScanned = jest.fn();

    handoff.useLanQrScannerStore.getState().open(onScanned);
    handoff.useLanQrScannerStore.getState().close();
    handoff.useLanQrScannerStore.getState().complete({
      urls: ['http://ignored.local'],
      username: 'ignored',
      password: 'ignored',
    });

    expect(onScanned).not.toHaveBeenCalled();
  });
});
