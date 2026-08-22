import {
  clearActivate,
  clipboardManager,
  clipboardMonitor,
  noteApplied,
  useClipboardStore,
} from '@/features/clipboard';
import { useHistoryStore } from '@/features/history';
import type { ApplyLanRemoteTextInput } from './internal/lanSyncAdapter';
import { LanRemoteTextApplier } from './internal/lanRemoteTextApplier';

const productionApplier = new LanRemoteTextApplier({
  pauseClipboardMonitoring: () => clipboardMonitor.pausePolling(),
  resumeClipboardMonitoring: () => clipboardMonitor.resumePolling(),
  setClipboardContent: (content) => clipboardManager.setClipboardContent(content),
  setClipboardWatermark: (content) => clipboardMonitor.setLastContent(content),
  noteApplied,
  clearActivate,
  addHistoryItem: (item) => useHistoryStore.getState().addItem(item),
  setCurrentContentDisplay: (content) =>
    useClipboardStore.getState().setCurrentContentDisplay(content),
});

export function applyLanRemoteText(input: ApplyLanRemoteTextInput): Promise<void> {
  return productionApplier.apply(input);
}
