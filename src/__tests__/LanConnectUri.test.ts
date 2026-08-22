import { describe, expect, it } from '@jest/globals';

function loadParser():
  | {
      parseLanConnectUri(
        raw: string
      ):
        | { ok: true; value: { urls: string[]; username: string; password: string; name?: string } }
        | { ok: false; error: string };
    }
  | undefined {
  try {
    return require('../features/lan-servers/connectUri');
  } catch {
    return undefined;
  }
}

function uri(payload: Record<string, unknown>, envelope = 'v=1&svc=mobile-sync'): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `uniclipboard://connect?${envelope}&p=${encoded}`;
}

describe('parseLanConnectUri', () => {
  it('decodes ordered server candidates and credentials', () => {
    const parser = loadParser();
    expect(parser).toBeDefined();
    if (!parser) return;

    const result = parser.parseLanConnectUri(
      uri({
        v: 1,
        url: 'http://192.168.1.5:42720',
        urls: [
          ' https://home.example.com/ ',
          'http://192.168.1.5:42720',
          42,
          'ftp://ignored.example.com',
        ],
        user: 'mobile_user',
        pwd: 'secret password',
        o: { label: 'Home', ignored: 'value' },
      })
    );

    expect(result).toEqual({
      ok: true,
      value: {
        urls: ['http://192.168.1.5:42720', 'https://home.example.com'],
        username: 'mobile_user',
        password: 'secret password',
        name: 'Home',
      },
    });
  });

  it.each([
    ['https://example.com', 'INVALID_SCHEME'],
    ['uniclipboard://connect?v=2&svc=mobile-sync&p=e30', 'UNSUPPORTED_VERSION'],
    ['uniclipboard://connect?v=1&svc=other&p=e30', 'UNSUPPORTED_SERVICE'],
    ['uniclipboard://connect?v=1&svc=mobile-sync&p=not-valid!', 'PAYLOAD_DECODE_FAILED'],
    [uri({ v: 1, url: 'http://home.local', user: 'user' }), 'MISSING_FIELD'],
    [uri({ v: 1, url: 'ftp://home.local', user: 'user', pwd: 'password' }), 'INVALID_URL'],
  ])('maps %s to %s without throwing', (raw, error) => {
    const parser = loadParser();
    expect(parser).toBeDefined();
    if (!parser) return;

    expect(parser.parseLanConnectUri(raw)).toEqual({ ok: false, error });
  });

  it('does not expose the password through an error', () => {
    const parser = loadParser();
    expect(parser).toBeDefined();
    if (!parser) return;
    const password = 'do-not-report-this';

    const result = parser.parseLanConnectUri(
      uri({ v: 1, url: 'ftp://home.local', user: 'user', pwd: password })
    );

    expect(JSON.stringify(result)).not.toContain(password);
  });

  it('accepts the development app scheme in a development build', () => {
    const parser = loadParser();
    expect(parser).toBeDefined();
    if (!parser) return;
    const raw = uri({
      v: 1,
      url: 'http://home.local:42720',
      user: 'user',
      pwd: 'password',
    }).replace('uniclipboard://', 'uniclipboard-dev://');

    expect(parser.parseLanConnectUri(raw)).toEqual(expect.objectContaining({ ok: true }));
  });
});
