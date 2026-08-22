export const LAN_CONNECT_URI_PREFIX = 'uniclipboard://connect';
export const LAN_CONNECT_URI_DEV_PREFIX = 'uniclipboard-dev://connect';

export type LanConnectUriError =
  | 'INVALID_SCHEME'
  | 'UNSUPPORTED_VERSION'
  | 'UNSUPPORTED_SERVICE'
  | 'PAYLOAD_DECODE_FAILED'
  | 'MISSING_FIELD'
  | 'INVALID_URL';

export interface LanConnectIntent {
  urls: string[];
  username: string;
  password: string;
  name?: string;
}

export type ParseLanConnectUriResult =
  | { ok: true; value: LanConnectIntent }
  | { ok: false; error: LanConnectUriError };

function splitConnectUri(raw: string): { scheme: string; host: string; query: string } | null {
  const match = raw.match(
    /^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\/([^/?#]+)(?:\/[^?#]*)?(?:\?([^#]*))?(?:#.*)?$/
  );
  if (!match) return null;
  return { scheme: match[1], host: match[2], query: match[3] ?? '' };
}

function queryParameters(query: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const separator = part.indexOf('=');
    const rawKey = separator < 0 ? part : part.slice(0, separator);
    const rawValue = separator < 0 ? '' : part.slice(separator + 1);
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      if (!result.has(key)) result.set(key, value);
    } catch {
      if (!result.has(rawKey)) result.set(rawKey, rawValue);
    }
  }
  return result;
}

function decodeBase64Url(value: string): string {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = base64.length % 4;
  if (remainder === 1) throw new Error('invalid base64url length');
  if (remainder === 2) base64 += '==';
  if (remainder === 3) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return null;
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function parseLanConnectUri(rawInput: string): ParseLanConnectUriResult {
  const raw = (rawInput ?? '').trim();
  const split = splitConnectUri(raw);
  const scheme = split?.scheme.toLowerCase();
  const supportedScheme = scheme === 'uniclipboard' || (__DEV__ && scheme === 'uniclipboard-dev');
  if (!split || !supportedScheme || split.host.toLowerCase() !== 'connect') {
    return { ok: false, error: 'INVALID_SCHEME' };
  }

  const params = queryParameters(split.query);
  if (params.get('v') !== '1') return { ok: false, error: 'UNSUPPORTED_VERSION' };
  if (params.get('svc') !== 'mobile-sync') {
    return { ok: false, error: 'UNSUPPORTED_SERVICE' };
  }

  const encodedPayload = params.get('p');
  if (!encodedPayload) return { ok: false, error: 'PAYLOAD_DECODE_FAILED' };

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return { ok: false, error: 'PAYLOAD_DECODE_FAILED' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'PAYLOAD_DECODE_FAILED' };
  }

  const object = payload as Record<string, unknown>;
  if (object.v !== 1) return { ok: false, error: 'UNSUPPORTED_VERSION' };
  if (
    typeof object.url !== 'string' ||
    object.url.length === 0 ||
    typeof object.user !== 'string' ||
    object.user.length === 0 ||
    typeof object.pwd !== 'string' ||
    object.pwd.length === 0
  ) {
    return { ok: false, error: 'MISSING_FIELD' };
  }

  const primary = normalizeHttpUrl(object.url);
  if (!primary) return { ok: false, error: 'INVALID_URL' };
  const urls = [primary];
  const candidates = Array.isArray(object.urls) ? object.urls : [];
  for (const candidate of candidates) {
    const normalized = normalizeHttpUrl(candidate);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  }

  const other =
    object.o && typeof object.o === 'object' && !Array.isArray(object.o)
      ? (object.o as Record<string, unknown>)
      : null;
  const name = typeof other?.label === 'string' && other.label ? other.label : undefined;

  return {
    ok: true,
    value: {
      urls,
      username: object.user,
      password: object.pwd,
      ...(name ? { name } : {}),
    },
  };
}
