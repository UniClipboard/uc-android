import {
  LAN_CONNECT_URI_DEV_PREFIX,
  LAN_CONNECT_URI_PREFIX,
  parseLanConnectUri,
  type LanConnectUriError,
} from './connectUri';
import { usePendingLanConnectStore } from './handoff';

export type LanConnectUrlIngestResult =
  | { matched: false }
  | { matched: true; queued: true }
  | { matched: true; queued: false; error: LanConnectUriError };

export function ingestLanConnectUrl(raw: string | null | undefined): LanConnectUrlIngestResult {
  const value = raw?.trim() ?? '';
  const lower = value.toLowerCase();
  if (
    !lower.startsWith(LAN_CONNECT_URI_PREFIX) &&
    !(__DEV__ && lower.startsWith(LAN_CONNECT_URI_DEV_PREFIX))
  ) {
    return { matched: false };
  }

  const parsed = parseLanConnectUri(value);
  if (!parsed.ok) return { matched: true, queued: false, error: parsed.error };
  usePendingLanConnectStore.getState().set(parsed.value);
  return { matched: true, queued: true };
}
