import axios from 'axios';
import { Base64 } from 'js-base64';
import {
  ReactNativeBlobLanTransport,
  type LanInsecureHttpTransport,
} from '@/features/lan-sync/lanInsecureHttpTransport';

export type LanServerProbeResult = 'Success' | 'AuthFailed' | 'Unreachable' | 'MissingFields';

export interface ProbeLanServersInput {
  urls: string[];
  username: string;
  password: string;
  allowInsecureTls?: boolean;
  timeoutMs?: number;
}

interface ProbeLanServersDependencies {
  insecureTransport: Pick<LanInsecureHttpTransport, 'getJson'>;
}

const defaultDependencies: ProbeLanServersDependencies = {
  insecureTransport: new ReactNativeBlobLanTransport(),
};

function probeEndpoint(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/SyncClipboard.json`;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

async function probeOne(
  baseUrl: string,
  username: string,
  password: string,
  timeoutMs: number,
  allowInsecureTls: boolean,
  dependencies: ProbeLanServersDependencies
): Promise<LanServerProbeResult> {
  const endpoint = probeEndpoint(baseUrl);
  if (!endpoint) return 'Unreachable';
  try {
    const response = allowInsecureTls
      ? await dependencies.insecureTransport.getJson(endpoint, {
          authorization: `Basic ${Base64.encode(`${username}:${password}`)}`,
        })
      : await axios.get(endpoint, {
          auth: { username, password },
          timeout: timeoutMs,
          responseType: 'text',
          transformResponse: [(body) => body],
          validateStatus: () => true,
        });
    if ((response.status >= 200 && response.status < 300) || response.status === 404) {
      return 'Success';
    }
    return response.status === 401 ? 'AuthFailed' : 'Unreachable';
  } catch {
    return 'Unreachable';
  }
}

export async function probeLanServers(
  { urls, username, password, allowInsecureTls = false, timeoutMs = 3000 }: ProbeLanServersInput,
  dependencies: ProbeLanServersDependencies = defaultDependencies
): Promise<Record<string, LanServerProbeResult>> {
  const candidates = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (!username.trim() || !password) {
    return Object.fromEntries(candidates.map((url) => [url, 'MissingFields']));
  }
  const results = await Promise.all(
    candidates.map(
      async (url) =>
        [
          url,
          await probeOne(url, username.trim(), password, timeoutMs, allowInsecureTls, dependencies),
        ] as const
    )
  );
  return Object.fromEntries(results);
}
