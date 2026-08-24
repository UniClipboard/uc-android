import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('iOS keyboard selected sync transport', () => {
  it('shares the selected sync method and LAN profiles without a current-server field', () => {
    const dto = read('src/platform/app-group/appGroupAdapter.ts');
    const sharedSettings = read('modules/app-group-store/ios/Shared/AppSettings.swift');

    expect(dto).toContain("syncChannel?: 'lan' | 'p2p'");
    expect(dto).toContain('lanServers?: AppGroupLanServerDTO[]');
    expect(dto).not.toContain('activeLanServerId');
    expect(dto).not.toMatch(/AppGroupLanServerDTO[\s\S]{0,300}password/);
    expect(sharedSettings).toContain('public var syncChannel: SyncChannel');
    expect(sharedSettings).toContain('public var lanServers: [LanServerProfile]');
    expect(sharedSettings).not.toContain('activeLanServerId');
  });

  it('stores LAN passwords in the keychain shared with the keyboard extension', () => {
    const module = read('modules/app-group-store/ios/AppGroupStoreModule.swift');
    const credentials = read('modules/app-group-store/ios/Shared/LanServerCredentialStore.swift');
    const typescript = read('src/features/lan-servers/secureStorage.ios.ts');

    expect(module).toContain('getLanServerPassword');
    expect(module).toContain('setLanServerPassword');
    expect(module).toContain('deleteLanServerPassword');
    expect(credentials).toContain('kSecAttrAccessGroup');
    expect(credentials).toContain('UCP2PKeychainAccessGroup');
    expect(typescript).toContain('getLanServerPassword');
    expect(typescript).toContain('setLanServerPassword');
    expect(typescript).toContain('deleteLanServerPassword');
  });

  it('uses one bidirectional keyboard interface with separate LAN and P2P implementations', () => {
    const router = read('targets/keyboard/ExtensionSyncRouter.swift');
    const lan = read('targets/keyboard/KeyboardLanSyncTransport.swift');

    expect(router).toContain('func synchronize(_ snapshot: DeviceClipboardSnapshot?) async throws');
    expect(router).toContain('func waitForRemoteChange(timeoutMs: UInt64) async throws');
    expect(router).toContain('func stop()');
    expect(lan).toContain('final class KeyboardLanSyncTransport');
    expect(lan).toContain('SyncClipboard.json');
    expect(lan).toContain('httpMethod = "PUT"');
    expect(lan).toContain('httpMethod = "GET"');
    expect(lan).toContain('Authorization');
    expect(lan).toContain('for (_, client) in currentClients');
  });

  it('switches away from the old transport even when its receive wait fails', () => {
    const keyboard = read('targets/keyboard/KeyboardModel.swift');
    const receiveLoop = keyboard.match(
      /private func startTransportReceiving\([\s\S]*?\n    \}/
    )?.[0];

    expect(receiveLoop).toBeDefined();
    expect(receiveLoop).toContain('selectionChanged(from: transport)');
    expect(receiveLoop).toMatch(
      /catch[\s\S]*?selectionChanged\(from: transport\)[\s\S]*?requestSync\(\.appeared\)/
    );
  });
});
