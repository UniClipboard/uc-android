import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';
import type { LanServerProfile } from '@/types/lan';

interface LegacyLanServer {
  type?: unknown;
  name?: unknown;
  url?: unknown;
  urls?: unknown;
  username?: unknown;
  password?: unknown;
}

export interface LegacyLanServerMigration {
  sourceIndex: number;
  profile: LanServerProfile;
  inlinePassword: string | null;
  credentialStorageKeys: string[];
}

export function migrateStoredSettings(raw: unknown, sourceSchemaVersion: number): AppSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };

  const old = raw as Record<string, unknown>;
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (old[key] !== undefined) result[key] = old[key];
  }

  const legacyServers = getLegacyLanServerMigrations(old);
  const currentLanServers = Array.isArray(result.lanServers)
    ? (result.lanServers as LanServerProfile[])
    : [];
  if (legacyServers.length > 0) {
    result.lanServers = mergeLanServerProfiles(
      currentLanServers,
      legacyServers.map(({ profile }) => profile)
    );
  }

  result.syncChannel = resolveStoredSyncChannel(old, sourceSchemaVersion, legacyServers.length > 0);

  return result as unknown as AppSettings;
}

export function getLegacyLanServerMigrations(raw: unknown): LegacyLanServerMigration[] {
  if (!raw || typeof raw !== 'object') return [];
  const old = raw as Record<string, unknown>;
  if (!Array.isArray(old.servers)) return [];
  const allowInsecureTls = old.trustInsecureCert === true;

  return old.servers.flatMap((value, sourceIndex) => {
    if (!value || typeof value !== 'object') return [];
    const server = value as LegacyLanServer;
    if (server.type !== undefined && server.type !== 'syncclipboard') return [];

    const urls = normalizeLegacyUrls(server);
    const username = typeof server.username === 'string' ? server.username.trim() : '';
    if (urls.length === 0 || !username) return [];

    const id = makeLegacyLanServerId(sourceIndex, urls[0], username);
    const inlinePassword =
      typeof server.password === 'string' && server.password.length > 0 ? server.password : null;

    return [
      {
        sourceIndex,
        profile: {
          id,
          name: typeof server.name === 'string' ? server.name.trim() : '',
          urls,
          username,
          allowInsecureTls,
        },
        inlinePassword,
        credentialStorageKeys: legacyCredentialStorageKeys(server, urls[0], username),
      },
    ];
  });
}

function legacyCredentialStorageKeys(
  server: LegacyLanServer,
  normalizedUrl: string,
  username: string
): string[] {
  const rawUrls = [
    typeof server.url === 'string' ? server.url.trim() : '',
    ...(Array.isArray(server.urls)
      ? server.urls.flatMap((value) => (typeof value === 'string' ? [value.trim()] : []))
      : []),
    normalizedUrl,
  ];
  return [...new Set(rawUrls.filter(Boolean))].map(
    (url) => `@syncclipboard:secure:credentials:${url}:${username}`
  );
}

function resolveStoredSyncChannel(
  old: Record<string, unknown>,
  sourceSchemaVersion: number,
  hasLegacyLanServers: boolean
): AppSettings['syncChannel'] {
  if (old.syncChannel === 'lan' || old.syncChannel === 'p2p') return old.syncChannel;

  const hasCurrentLanServers = Array.isArray(old.lanServers) && old.lanServers.length > 0;
  if (
    hasLegacyLanServers ||
    hasCurrentLanServers ||
    old.legacyLanEligible === true ||
    sourceSchemaVersion <= 5
  ) {
    return 'lan';
  }

  return 'p2p';
}

function normalizeLegacyUrls(server: LegacyLanServer): string[] {
  const candidates =
    Array.isArray(server.urls) && server.urls.length > 0 ? server.urls : [server.url];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const raw = candidate.trim();
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      parsed.hash = '';
      const normalized = parsed.toString().replace(/\/$/, '');
      if (!seen.has(normalized)) {
        seen.add(normalized);
        urls.push(normalized);
      }
    } catch {
      continue;
    }
  }
  return urls;
}

function makeLegacyLanServerId(index: number, url: string, username: string): string {
  let hash = 0x811c9dc5;
  const input = `${url}\0${username}`;
  for (let position = 0; position < input.length; position += 1) {
    hash ^= input.charCodeAt(position);
    hash = Math.imul(hash, 0x01000193);
  }
  return `legacy-lan-${index}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function mergeLanServerProfiles(
  current: LanServerProfile[],
  legacy: LanServerProfile[]
): LanServerProfile[] {
  const merged = current.map((server) => ({ ...server, urls: [...server.urls] }));
  const ids = new Set(merged.map(({ id }) => id));
  for (const server of legacy) {
    if (!ids.has(server.id)) {
      ids.add(server.id);
      merged.push(server);
    }
  }
  return merged;
}
