import * as SecureStore from 'expo-secure-store';

const SECRET_PREFIX = 'uniclip.lan.server.';
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: 'app.uniclipboard.lan-servers',
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const lanServerSecretStore = {
  get: (serverId: string): Promise<string | null> =>
    SecureStore.getItemAsync(`${SECRET_PREFIX}${serverId}`, SECURE_STORE_OPTIONS),
  set: (serverId: string, password: string): Promise<void> =>
    SecureStore.setItemAsync(`${SECRET_PREFIX}${serverId}`, password, SECURE_STORE_OPTIONS),
  delete: (serverId: string): Promise<void> =>
    SecureStore.deleteItemAsync(`${SECRET_PREFIX}${serverId}`, SECURE_STORE_OPTIONS),
};
