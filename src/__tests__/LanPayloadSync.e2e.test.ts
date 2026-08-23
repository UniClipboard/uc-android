import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { LanHttpClient } from '../features/lan-sync/internal/lanHttpClient';
import { LanSyncAdapter } from '../features/lan-sync/internal/lanSyncAdapter';
import type { LanClipboardDocument } from '../features/lan-sync/internal/lanHttpClient';

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

async function requestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function startDesktopFixture() {
  const expectedAuth = `Basic ${Buffer.from('mobile:secret').toString('base64')}`;
  const payloads = new Map<string, Buffer>();
  const events: string[] = [];
  let document: LanClipboardDocument = {
    type: 'Text',
    hash: 'INITIAL_HASH',
    text: 'already local',
    hasData: false,
    size: 13,
  };
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== expectedAuth) {
      response.writeHead(401).end();
      return;
    }
    if (request.url === '/SyncClipboard.json') {
      if (request.method === 'GET') {
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify(document));
        return;
      }
      document = JSON.parse((await requestBody(request)).toString('utf8')) as LanClipboardDocument;
      events.push('metadata');
      response.writeHead(204).end();
      return;
    }
    if (request.url?.startsWith('/file/')) {
      const name = decodeURIComponent(request.url.slice('/file/'.length));
      if (request.method === 'PUT') {
        payloads.set(name, await requestBody(request));
        events.push('payload');
        response.writeHead(204).end();
        return;
      }
      const payload = payloads.get(name);
      if (!payload) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/octet-stream' }).end(payload);
      return;
    }
    response.writeHead(404).end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing desktop fixture address');
  return {
    url: `http://127.0.0.1:${address.port}`,
    payloads,
    events,
    getDocument: () => document,
    setDocument: (next: LanClipboardDocument) => {
      document = next;
    },
  };
}

describe('LAN payload sync end to end', () => {
  it('uploads an image and downloads the next remote file through real HTTP', async () => {
    const desktop = await startDesktopFixture();
    const localFiles = new Map<string, Uint8Array>();
    const imageUri = 'file:///cache/mobile-image.png';
    const imageBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]);
    localFiles.set(imageUri, imageBytes);
    const client = new LanHttpClient({
      async uploadFile(sourceUri, url, headers) {
        const response = await fetch(url, {
          method: 'PUT',
          headers,
          body: localFiles.get(sourceUri),
        });
        return { status: response.status };
      },
      async downloadFile(url, destinationUri, headers) {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`download failed: ${response.status}`);
        localFiles.set(destinationUri, new Uint8Array(await response.arrayBuffer()));
        return destinationUri;
      },
    });
    const applyRemoteContent = jest.fn(async () => undefined);
    const server = {
      name: 'Desktop',
      urls: [desktop.url],
      username: 'mobile',
      password: 'secret',
      allowInsecureTls: false,
    };
    const adapter = new LanSyncAdapter({
      getActiveServer: async () => server,
      readClipboard: async () => ({ type: 'Text', profileHash: 'INITIAL_HASH' }),
      applyRemoteContent,
      preparePayloadTempUri: (profileHash, dataName) => `file:///cache/${profileHash}-${dataName}`,
      client,
    });
    await adapter.start({
      appVersion: '2.0.0',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: false },
    });

    const imageHash = sha256(imageBytes);
    await adapter.sendImportedAsset(
      { kind: 'image', uri: imageUri, mimeType: 'image/png' },
      imageHash
    );

    expect(desktop.events).toEqual(['payload', 'metadata']);
    expect(desktop.payloads.get('image.png')).toEqual(Buffer.from(imageBytes));
    expect(desktop.getDocument()).toEqual({
      type: 'Image',
      hash: imageHash,
      text: 'image.png',
      hasData: true,
      dataName: 'image.png',
      size: 1000,
    });

    const remoteBytes = new Uint8Array([10, 20, 30, 40, 50]);
    const remoteHash = sha256(remoteBytes);
    desktop.payloads.set('report.pdf', Buffer.from(remoteBytes));
    desktop.setDocument({
      type: 'File',
      hash: remoteHash,
      contentId: 'blake3v1:remote-file',
      text: 'report.pdf',
      hasData: true,
      dataName: 'report.pdf',
      size: remoteBytes.byteLength,
    });

    await adapter.synchronize();

    const downloadedUri = `file:///cache/${remoteHash}-report.pdf`;
    expect(localFiles.get(downloadedUri)).toEqual(remoteBytes);
    expect(applyRemoteContent).toHaveBeenCalledWith({
      type: 'File',
      text: 'report.pdf',
      profileHash: remoteHash,
      contentId: 'blake3v1:remote-file',
      hasData: true,
      dataName: 'report.pdf',
      fileUri: downloadedUri,
      size: remoteBytes.byteLength,
    });
    await adapter.stop();
  });
});
