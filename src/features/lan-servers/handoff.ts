import { create } from 'zustand';
import type { LanConnectIntent } from './connectUri';

interface PendingLanConnectState {
  intent: LanConnectIntent | null;
  set(intent: LanConnectIntent): void;
  consume(): LanConnectIntent | null;
  clear(): void;
}

export const usePendingLanConnectStore = create<PendingLanConnectState>((set, get) => ({
  intent: null,
  set: (intent) => set({ intent }),
  consume: () => {
    const intent = get().intent;
    if (intent) set({ intent: null });
    return intent;
  },
  clear: () => set({ intent: null }),
}));

interface LanQrScannerState {
  isVisible: boolean;
  onScanned: ((intent: LanConnectIntent) => void) | null;
  open(onScanned: (intent: LanConnectIntent) => void): void;
  complete(intent: LanConnectIntent): void;
  close(): void;
}

export const useLanQrScannerStore = create<LanQrScannerState>((set, get) => ({
  isVisible: false,
  onScanned: null,
  open: (onScanned) => set({ isVisible: true, onScanned }),
  complete: (intent) => {
    const callback = get().onScanned;
    set({ isVisible: false, onScanned: null });
    callback?.(intent);
  },
  close: () => set({ isVisible: false, onScanned: null }),
}));
