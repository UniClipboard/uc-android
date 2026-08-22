import {
  createDefaultClipboardItem,
  HistorySyncStatus,
  type ClipboardContent,
} from '@/types/clipboard';
import type { ApplyLanRemoteTextInput } from './lanSyncAdapter';

export interface LanRemoteTextApplierDependencies {
  pauseClipboardMonitoring(): void;
  resumeClipboardMonitoring(): void;
  setClipboardContent(content: ClipboardContent): Promise<void>;
  setClipboardWatermark(content: ClipboardContent): Promise<void>;
  noteApplied(hash: string | null): void;
  clearActivate(): Promise<void>;
  addHistoryItem(item: ReturnType<typeof createDefaultClipboardItem>): Promise<unknown>;
  setCurrentContentDisplay(content: ClipboardContent): void;
}

export class LanRemoteTextApplier {
  constructor(private readonly dependencies: LanRemoteTextApplierDependencies) {}

  async apply(input: ApplyLanRemoteTextInput): Promise<void> {
    this.dependencies.pauseClipboardMonitoring();
    try {
      const content: ClipboardContent = {
        type: 'Text',
        text: input.text,
        profileHash: input.profileHash,
        localClipboardHash: input.profileHash,
        fileSize: input.size,
        hasData: false,
        timestamp: Date.now(),
      };
      await this.dependencies.setClipboardContent(content);
      await this.dependencies.setClipboardWatermark(content);
      this.dependencies.noteApplied(input.profileHash);
      await this.dependencies.clearActivate();
      await this.dependencies.addHistoryItem(
        createDefaultClipboardItem({
          type: 'Text',
          text: input.text,
          profileHash: input.profileHash,
          localClipboardHash: input.profileHash,
          hasData: false,
          size: input.size,
          timestamp: content.timestamp!,
          syncStatus: HistorySyncStatus.Synced,
          from: 'server',
          contentId: input.contentId,
        })
      );
      this.dependencies.setCurrentContentDisplay(content);
    } finally {
      this.dependencies.resumeClipboardMonitoring();
    }
  }
}
