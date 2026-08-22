import { Buffer } from 'node:buffer';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from '@jest/globals';

function loadClient():
  | {
      LanHttpClient: new () => {
        getClipboard(server: unknown): Promise<{ document: unknown; url: string } | null>;
        putClipboard(server: unknown, document: unknown): Promise<{ url: string }>;
      };
    }
  | undefined {
  try {
    return require('../features/lan-sync/internal/lanHttpClient');
  } catch {
    return undefined;
  }
}

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function fixtureServer() {
  const requests: Array<{ method?: string; url?: string; authorization?: string; body: string }> =
    [];
  const expectedAuth = `Basic ${Buffer.from('mobile:secret').toString('base64')}`;
  const document = {
    type: 'Text',
    hash: 'ABC123',
    contentId: 'blake3v1:server-text',
    text: 'from desktop',
    hasData: false,
    size: 12,
  };
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        body,
      });
      if (request.url?.startsWith('/broken/')) {
        response.writeHead(500).end();
        return;
      }
      if (request.headers.authorization !== expectedAuth) {
        response.writeHead(401).end();
        return;
      }
      if (request.method === 'GET') {
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify(document));
        return;
      }
      response.writeHead(204).end();
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing fixture address');
  return { base: `http://127.0.0.1:${address.port}`, requests, document };
}

describe('LanHttpClient', () => {
  it('tries candidates in order and reads the authenticated clipboard document', async () => {
    const module = loadClient();
    expect(module).toBeDefined();
    if (!module) return;
    const fixture = await fixtureServer();
    const client = new module.LanHttpClient();
    const server = {
      urls: [`${fixture.base}/broken`, `${fixture.base}/ok`],
      username: 'mobile',
      password: 'secret',
      allowInsecureTls: false,
    };

    await expect(client.getClipboard(server)).resolves.toEqual({
      document: fixture.document,
      url: `${fixture.base}/ok`,
    });
    expect(fixture.requests.map((request) => request.url)).toEqual([
      '/broken/SyncClipboard.json',
      '/ok/SyncClipboard.json',
    ]);
    expect(fixture.requests[1].authorization).toMatch(/^Basic /);
  });

  it('uploads the exact text document with Basic Auth', async () => {
    const module = loadClient();
    expect(module).toBeDefined();
    if (!module) return;
    const fixture = await fixtureServer();
    const client = new module.LanHttpClient();
    const server = {
      urls: [`${fixture.base}/ok`],
      username: 'mobile',
      password: 'secret',
      allowInsecureTls: false,
    };
    const document = {
      type: 'Text',
      hash: 'LOCAL_HASH',
      text: 'from phone',
      hasData: false,
      size: 10,
    };

    await expect(client.putClipboard(server, document)).resolves.toEqual({
      url: `${fixture.base}/ok`,
    });
    expect(fixture.requests[0]).toEqual({
      method: 'PUT',
      url: '/ok/SyncClipboard.json',
      authorization: expect.stringMatching(/^Basic /),
      body: JSON.stringify(document),
    });
  });
});
