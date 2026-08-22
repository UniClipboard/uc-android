import axios from 'axios';
import type { LanServerDraft } from '@/features/lan-servers';

export interface LanClipboardDocument {
  type: 'Text' | 'Image' | 'File' | 'Group';
  hash?: string;
  contentId?: string;
  text: string;
  hasData: boolean;
  dataName?: string;
  size?: number;
}

export class LanAuthenticationError extends Error {
  constructor() {
    super('LAN server authentication failed');
    this.name = 'LanAuthenticationError';
  }
}

export class LanUnavailableError extends Error {
  constructor() {
    super('LAN server is unavailable');
    this.name = 'LanUnavailableError';
  }
}

function endpoint(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/SyncClipboard.json`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function isDocument(value: unknown): value is LanClipboardDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const doc = value as Record<string, unknown>;
  return (
    (doc.type === 'Text' || doc.type === 'Image' || doc.type === 'File' || doc.type === 'Group') &&
    typeof doc.text === 'string' &&
    typeof doc.hasData === 'boolean'
  );
}

export class LanHttpClient {
  async getClipboard(
    server: LanServerDraft
  ): Promise<{ document: LanClipboardDocument; url: string } | null> {
    for (const baseUrl of server.urls) {
      try {
        const response = await axios.get(endpoint(baseUrl), {
          auth: { username: server.username, password: server.password },
          timeout: 5000,
          validateStatus: () => true,
        });
        if (response.status === 401) throw new LanAuthenticationError();
        if (response.status === 404) return null;
        if (response.status < 200 || response.status >= 300 || !isDocument(response.data)) continue;
        return { document: response.data, url: baseUrl };
      } catch (error) {
        if (error instanceof LanAuthenticationError) throw error;
      }
    }
    throw new LanUnavailableError();
  }

  async putClipboard(
    server: LanServerDraft,
    document: LanClipboardDocument
  ): Promise<{ url: string }> {
    for (const baseUrl of server.urls) {
      try {
        const response = await axios.put(endpoint(baseUrl), document, {
          auth: { username: server.username, password: server.password },
          timeout: 5000,
          validateStatus: () => true,
        });
        if (response.status === 401) throw new LanAuthenticationError();
        if (response.status >= 200 && response.status < 300) return { url: baseUrl };
      } catch (error) {
        if (error instanceof LanAuthenticationError) throw error;
      }
    }
    throw new LanUnavailableError();
  }
}
