import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { configStorage } from '@/features/settings';
import { configureLanServerService } from './internal/lanServerService';

const SECRET_PREFIX = 'uniclip.lan.server.';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'app.uniclipboard.lan-servers',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export function configureProductionLanServerService(): void {
  configureLanServerService({
    settings: {
      async read() {
        const settings = await configStorage.getConfig();
        return {
          servers: settings.lanServers.map((server) => ({ ...server, urls: [...server.urls] })),
          activeServerId: settings.activeLanServerId,
        };
      },
      async write(snapshot) {
        await configStorage.updateConfig({
          lanServers: snapshot.servers,
          activeLanServerId: snapshot.activeServerId,
        });
      },
    },
    secrets: {
      get: (serverId) =>
        SecureStore.getItemAsync(`${SECRET_PREFIX}${serverId}`, SECURE_STORE_OPTIONS),
      set: (serverId, password) =>
        SecureStore.setItemAsync(`${SECRET_PREFIX}${serverId}`, password, SECURE_STORE_OPTIONS),
      delete: (serverId) =>
        SecureStore.deleteItemAsync(`${SECRET_PREFIX}${serverId}`, SECURE_STORE_OPTIONS),
    },
    createId: () => Crypto.randomUUID(),
  });
}
