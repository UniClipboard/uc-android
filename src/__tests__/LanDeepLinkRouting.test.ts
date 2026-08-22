import { describe, expect, it } from '@jest/globals';

function loadRouting():
  | {
      ingestLanConnectUrl(
        raw: string | null | undefined
      ):
        | { matched: false }
        | { matched: true; queued: true }
        | { matched: true; queued: false; error: string };
      usePendingLanConnectStore: {
        getState(): { consume(): unknown; clear(): void };
      };
    }
  | undefined {
  try {
    return {
      ...require('../features/lan-servers/deepLink'),
      ...require('../features/lan-servers/handoff'),
    };
  } catch {
    return undefined;
  }
}

function validUri(): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      url: 'http://home.local:42720',
      user: 'mobile_user',
      pwd: 'secret',
      o: { label: 'Home' },
    }),
    'utf8'
  ).toString('base64url');
  return `uniclipboard://connect?v=1&svc=mobile-sync&p=${payload}`;
}

describe('LAN deep-link routing', () => {
  it('does not intercept unrelated app links', () => {
    const routing = loadRouting();
    expect(routing).toBeDefined();
    if (!routing) return;

    expect(routing.ingestLanConnectUrl('uniclipboard://quick-upload')).toEqual({ matched: false });
  });

  it('queues valid credentials for one-time settings consumption', () => {
    const routing = loadRouting();
    expect(routing).toBeDefined();
    if (!routing) return;
    routing.usePendingLanConnectStore.getState().clear();

    expect(routing.ingestLanConnectUrl(validUri())).toEqual({ matched: true, queued: true });
    expect(routing.usePendingLanConnectStore.getState().consume()).toEqual({
      urls: ['http://home.local:42720'],
      username: 'mobile_user',
      password: 'secret',
      name: 'Home',
    });
  });

  it('returns a fixed parse error without queuing credentials', () => {
    const routing = loadRouting();
    expect(routing).toBeDefined();
    if (!routing) return;
    routing.usePendingLanConnectStore.getState().clear();

    expect(
      routing.ingestLanConnectUrl('uniclipboard://connect?v=1&svc=mobile-sync&p=broken')
    ).toEqual({ matched: true, queued: false, error: 'PAYLOAD_DECODE_FAILED' });
    expect(routing.usePendingLanConnectStore.getState().consume()).toBeNull();
  });
});
