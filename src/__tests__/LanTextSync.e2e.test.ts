import { Buffer } from 'node:buffer';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { LanHttpClient } from '../features/lan-sync/internal/lanHttpClient';
import { LanSyncAdapter } from '../features/lan-sync/internal/lanSyncAdapter';
import type { LanClipboardDocument } from '../features/lan-sync/internal/lanHttpClient';

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function startDesktopFixture() {
  const expectedAuth = `Basic ${Buffer.from('mobile:secret').toString('base64')}`;
  let document: LanClipboardDocument = {
    type: 'Text',
    hash: 'DESKTOP_ONE',
    contentId: 'blake3v1:desktop-one',
    text: 'first desktop text',
    hasData: false,
    size: 18,
  };
  const server = createServer((request, response) => {
    if (request.headers.authorization !== expectedAuth) {
      response.writeHead(401).end();
      return;
    }
    if (request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(document));
      return;
    }
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      document = JSON.parse(body) as LanClipboardDocument;
      response.writeHead(204).end();
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing desktop fixture address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    getDocument: () => document,
    setDocument: (next: LanClipboardDocument) => {
      document = next;
    },
  };
}

describe('LAN text sync end to end', () => {
  it('pulls desktop text, uploads phone text, then applies the next desktop text', async () => {
    const desktop = await startDesktopFixture();
    const applyRemoteText = jest.fn(async () => undefined);
    const adapter = new LanSyncAdapter({
      getActiveServer: async () => ({
        name: 'Desktop',
        urls: [desktop.url],
        username: 'mobile',
        password: 'secret',
        allowInsecureTls: false,
      }),
      readClipboard: async () => null,
      applyRemoteText,
      client: new LanHttpClient(),
    });

    await adapter.start({
      appVersion: '2.0.0',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: false },
    });
    expect(applyRemoteText).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'first desktop text', profileHash: 'DESKTOP_ONE' })
    );

    await adapter.sendImportedText('phone text', 'PHONE_HASH');
    expect(desktop.getDocument()).toEqual({
      type: 'Text',
      hash: 'PHONE_HASH',
      text: 'phone text',
      hasData: false,
      size: 10,
    });

    desktop.setDocument({
      type: 'Text',
      hash: 'DESKTOP_TWO',
      contentId: 'blake3v1:desktop-two',
      text: 'second desktop text',
      hasData: false,
      size: 19,
    });
    await adapter.synchronize();
    expect(applyRemoteText).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'second desktop text', profileHash: 'DESKTOP_TWO' })
    );
    expect(applyRemoteText).toHaveBeenCalledTimes(2);
    await adapter.stop();
  });
});
