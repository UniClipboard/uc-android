import type { ClipboardContent } from '@/types/clipboard';
import type { LanServerDraft } from '@/features/lan-servers';
import type {
  SyncAdapter,
  SyncAdapterDelivery,
  SyncAdapterEvent,
  SyncImportedAsset,
  SyncRuntimePolicy,
  SyncSendOptions,
  SyncStartContext,
} from '@/features/sync/contracts';
import { LanHttpClient, type LanClipboardDocument } from './lanHttpClient';

const FOREGROUND_POLL_MS = 2000;
const BACKGROUND_POLL_MS = 15000;
const INLINE_TEXT_LIMIT = 10240;

export interface ApplyLanRemoteTextInput {
  text: string;
  profileHash: string;
  contentId?: string;
  size: number;
}

interface LanHttpPort {
  getClipboard(
    server: LanServerDraft
  ): Promise<{ document: LanClipboardDocument; url: string } | null>;
  putClipboard(server: LanServerDraft, document: LanClipboardDocument): Promise<{ url: string }>;
}

export interface LanSyncAdapterDependencies {
  getActiveServer(): Promise<LanServerDraft | null>;
  readClipboard(): Promise<ClipboardContent | null>;
  applyRemoteText(input: ApplyLanRemoteTextInput): Promise<void>;
  client?: LanHttpPort;
}

const delivered = (): SyncAdapterDelivery => ({
  success: true,
  state: 'delivered',
  counts: { accepted: 1, duplicate: 0, offline: 0, errored: 0, pending: 0 },
});

export class LanSyncAdapter implements SyncAdapter {
  readonly id = 'lan' as const;
  private readonly client: LanHttpPort;
  private server: LanServerDraft | null = null;
  private policy: SyncRuntimePolicy = {
    appState: 'unknown',
    backgroundSyncEnabled: false,
  };
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastRemoteIdentity: string | null = null;
  private readonly subscribers = new Set<(event: SyncAdapterEvent) => void>();

  constructor(private readonly dependencies: LanSyncAdapterDependencies) {
    this.client = dependencies.client ?? new LanHttpClient();
  }

  async start(context: SyncStartContext): Promise<void> {
    this.policy = context.policy;
    this.server = await this.dependencies.getActiveServer();
    if (!this.server) throw new Error('No active LAN server');
    this.running = true;
    await this.synchronize();
    this.schedulePolling();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.clearPolling();
    this.server = null;
    this.lastRemoteIdentity = null;
  }

  async refresh(policy: SyncRuntimePolicy): Promise<void> {
    this.policy = policy;
    this.server = await this.dependencies.getActiveServer();
    if (!this.server) throw new Error('No active LAN server');
    await this.synchronize();
    this.schedulePolling();
  }

  handleAppStateChange(policy: SyncRuntimePolicy): void {
    this.policy = policy;
    this.schedulePolling();
    if (policy.appState === 'active')
      void this.synchronize().catch((error) => this.emitFailure(error));
  }

  async synchronize(): Promise<void> {
    if (!this.server) throw new Error('LAN adapter is not started');
    const result = await this.client.getClipboard(this.server);
    if (!result) return;
    const document = result.document;
    if (document.type !== 'Text' || document.hasData) {
      throw new Error('LAN payload content is not supported yet');
    }
    if (!document.hash) throw new Error('LAN text is missing its content hash');
    const identity = document.contentId ?? document.hash;
    if (identity === this.lastRemoteIdentity) return;
    const current = await this.dependencies.readClipboard();
    if (current?.profileHash === document.hash) {
      this.lastRemoteIdentity = identity;
      return;
    }
    await this.dependencies.applyRemoteText({
      text: document.text,
      profileHash: document.hash,
      contentId: document.contentId,
      size: document.size ?? Array.from(document.text).length,
    });
    this.lastRemoteIdentity = identity;
    this.emit({ type: 'contentChanged' });
  }

  async sendCurrentClipboard(): Promise<SyncAdapterDelivery> {
    const content = await this.dependencies.readClipboard();
    if (!content?.text || content.type !== 'Text')
      throw new Error('LAN clipboard text is unavailable');
    if (!content.profileHash) throw new Error('LAN clipboard text is missing its content hash');
    return this.pushText(content.text, content.profileHash);
  }

  async sendImportedText(
    text: string,
    profileHash: string,
    _options?: SyncSendOptions
  ): Promise<SyncAdapterDelivery> {
    return this.pushText(text, profileHash);
  }

  async sendImportedAsset(
    _asset: SyncImportedAsset,
    _profileHash: string,
    _options?: SyncSendOptions
  ): Promise<SyncAdapterDelivery> {
    throw new Error('LAN image and file sending is not supported yet');
  }

  async observeClipboardChange(
    content: ClipboardContent,
    dispatch: boolean
  ): Promise<SyncAdapterDelivery | null> {
    if (!dispatch) return null;
    if (content.type !== 'Text' || !content.text || !content.profileHash) {
      throw new Error('LAN observed content is not supported yet');
    }
    return this.pushText(content.text, content.profileHash);
  }

  subscribe(listener: (event: SyncAdapterEvent) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private async pushText(text: string, profileHash: string): Promise<SyncAdapterDelivery> {
    if (!this.server) throw new Error('LAN adapter is not started');
    const size = Array.from(text).length;
    if (size > INLINE_TEXT_LIMIT) throw new Error('LAN long text payload is not supported yet');
    await this.client.putClipboard(this.server, {
      type: 'Text',
      hash: profileHash,
      text,
      hasData: false,
      size,
    });
    this.lastRemoteIdentity = profileHash;
    return delivered();
  }

  private schedulePolling(): void {
    this.clearPolling();
    if (!this.running) return;
    const interval =
      this.policy.appState === 'active'
        ? FOREGROUND_POLL_MS
        : this.policy.backgroundSyncEnabled
        ? BACKGROUND_POLL_MS
        : null;
    if (!interval) return;
    this.pollTimer = setInterval(() => {
      void this.synchronize().catch((error) => this.emitFailure(error));
    }, interval);
  }

  private clearPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private emit(event: SyncAdapterEvent): void {
    for (const subscriber of this.subscribers) subscriber(event);
  }

  private emitFailure(error: unknown): void {
    this.emit({ type: 'failed', message: error instanceof Error ? error.message : String(error) });
  }
}
