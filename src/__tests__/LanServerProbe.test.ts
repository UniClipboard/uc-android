import { createServer, type Server } from 'node:http';
import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it } from '@jest/globals';

type ProbeResult = 'Success' | 'AuthFailed' | 'Unreachable' | 'MissingFields';

function loadProbe():
  | {
      probeLanServers(input: {
        urls: string[];
        username: string;
        password: string;
        timeoutMs?: number;
      }): Promise<Record<string, ProbeResult>>;
    }
  | undefined {
  try {
    return require('../features/lan-servers/probeLanServers');
  } catch {
    return undefined;
  }
}

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function startServer(): Promise<string> {
  const expectedAuth = `Basic ${Buffer.from('mobile:secret', 'utf8').toString('base64')}`;
  const server = createServer((request, response) => {
    if (request.url === '/slow/SyncClipboard.json') {
      setTimeout(() => response.writeHead(200).end('{}'), 100);
      return;
    }
    if (request.headers.authorization !== expectedAuth) {
      response.writeHead(401).end();
      return;
    }
    if (request.url === '/empty/SyncClipboard.json') {
      response.writeHead(404).end();
      return;
    }
    if (request.url === '/broken/SyncClipboard.json') {
      response.writeHead(500).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test server address');
  return `http://127.0.0.1:${address.port}`;
}

describe('probeLanServers', () => {
  it('tests every candidate with Basic Auth and preserves candidate order', async () => {
    const probe = loadProbe();
    expect(probe).toBeDefined();
    if (!probe) return;
    const base = await startServer();
    const urls = [`${base}/ok`, `${base}/empty`, `${base}/broken`];

    await expect(
      probe.probeLanServers({ urls, username: 'mobile', password: 'secret' })
    ).resolves.toEqual({
      [urls[0]]: 'Success',
      [urls[1]]: 'Success',
      [urls[2]]: 'Unreachable',
    });
  });

  it('distinguishes authentication failure, missing fields, and timeout', async () => {
    const probe = loadProbe();
    expect(probe).toBeDefined();
    if (!probe) return;
    const base = await startServer();

    await expect(
      probe.probeLanServers({ urls: [`${base}/ok`], username: 'mobile', password: 'wrong' })
    ).resolves.toEqual({ [`${base}/ok`]: 'AuthFailed' });
    await expect(
      probe.probeLanServers({ urls: [`${base}/ok`], username: '', password: '' })
    ).resolves.toEqual({ [`${base}/ok`]: 'MissingFields' });
    await expect(
      probe.probeLanServers({
        urls: [`${base}/slow`],
        username: 'mobile',
        password: 'secret',
        timeoutMs: 20,
      })
    ).resolves.toEqual({ [`${base}/slow`]: 'Unreachable' });
  });
});
