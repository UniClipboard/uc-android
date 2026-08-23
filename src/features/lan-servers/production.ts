import * as Crypto from 'expo-crypto';
import { configStorage } from '@/features/settings';
import { configureLanServerService } from './internal/lanServerService';
import { lanServerSecretStore } from './secureStorage';

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
    secrets: lanServerSecretStore,
    createId: () => Crypto.randomUUID(),
  });
}
