/**
 * Config Storage Service
 * 配置存储服务 - 管理当前应用偏好
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/types/storage';
import { AppSettings, DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION } from '@/types/settings';
import { createLogger } from '@/support/observability';
import { seedConfigFromAppGroup } from '@/platform/app-group/appGroupSeed';
import { Base64 } from 'js-base64';
import { lanServerSecretStore } from '@/features/lan-servers/secureStorage';
import {
  clearLegacyLanConfiguration,
  getLegacyLanConfiguration,
  type LegacyLanConfigurationDTO,
} from 'app-group-store';
import {
  getLegacyLanServerMigrations,
  migrateStoredSettings,
  type LegacyLanServerMigration,
} from './migrateStoredSettings';

const log = createLogger('ConfigStorage');
const SETTINGS_SCHEMA_VERSION_KEY = '@syncclipboard:schema_version';
const LEGACY_LAN_MIGRATION_JOURNAL_KEY = '@syncclipboard:migration:legacy-lan:v1';

interface LegacyLanMigrationJournal {
  version: 1;
  serverIds: string[];
  credentialStorageKeys: string[];
}

/**
 * 配置存储服务
 */
export const CONFIG_USER_STATE_KEY = '@syncclipboard:config:user-state';

export class ConfigStorage {
  private static instance: ConfigStorage | null = null;
  private config: AppSettings | null = null;
  private initialized = false;
  private updateQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ConfigStorage {
    if (!ConfigStorage.instance) {
      ConfigStorage.instance = new ConfigStorage();
    }
    return ConfigStorage.instance;
  }

  /**
   * 初始化配置存储
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadConfig();
      this.initialized = true;
    } catch (error) {
      log.error('Failed to initialize:', error);
      this.config = { ...DEFAULT_SETTINGS };
      this.initialized = true;
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    const [configJson, versionValue, journalJson] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.CONFIG),
      AsyncStorage.getItem(SETTINGS_SCHEMA_VERSION_KEY),
      AsyncStorage.getItem(LEGACY_LAN_MIGRATION_JOURNAL_KEY),
    ]);

    if (configJson) {
      let savedConfig: unknown;
      try {
        savedConfig = JSON.parse(configJson);
      } catch (error) {
        throw new Error('Stored config is not valid JSON', { cause: error });
      }

      const parsedVersion = Number.parseInt(versionValue ?? '', 10);
      const storedVersion = Number.isFinite(parsedVersion) ? parsedVersion : 1;
      const existingJournal = parseLegacyLanMigrationJournal(journalJson);
      const nativeLegacyLan = await getLegacyLanConfiguration();
      const legacySource = mergeLegacyLanSources(savedConfig, nativeLegacyLan);
      const legacyLanMigrations = getLegacyLanServerMigrations(legacySource);

      if (existingJournal && legacyLanMigrations.length === 0) {
        this.config = migrateStoredSettings(savedConfig, storedVersion);
        if (storedVersion < SETTINGS_SCHEMA_VERSION) {
          await this.saveConfig();
          await AsyncStorage.setItem(SETTINGS_SCHEMA_VERSION_KEY, String(SETTINGS_SCHEMA_VERSION));
        }
        await this.retryLegacyLanCleanup(existingJournal);
        return;
      }

      this.config = migrateStoredSettings(legacySource, storedVersion);
      this.config.syncChannel = migrateStoredSettings(savedConfig, storedVersion).syncChannel;

      let migrationJournal: LegacyLanMigrationJournal | null = null;
      if (legacyLanMigrations.length > 0) {
        migrationJournal = createLegacyLanMigrationJournal(legacyLanMigrations);
        await AsyncStorage.setItem(
          LEGACY_LAN_MIGRATION_JOURNAL_KEY,
          JSON.stringify(migrationJournal)
        );
        await persistLegacyLanSecrets(legacyLanMigrations);
      }

      if (storedVersion < SETTINGS_SCHEMA_VERSION || migrationJournal) {
        await this.saveConfig();
      }
      if (storedVersion < SETTINGS_SCHEMA_VERSION) {
        await AsyncStorage.setItem(SETTINGS_SCHEMA_VERSION_KEY, String(SETTINGS_SCHEMA_VERSION));
      }
      if (migrationJournal) {
        await this.retryLegacyLanCleanup(migrationJournal);
      }
    } else {
      const seed = await seedConfigFromAppGroup();
      const nativeLegacyLan = await getLegacyLanConfiguration();
      const legacySource = nativeLegacyLan
        ? mergeLegacyLanSources(seed ?? {}, nativeLegacyLan)
        : null;
      const legacyLanMigrations = getLegacyLanServerMigrations(legacySource);
      this.config = legacySource
        ? migrateStoredSettings({ ...DEFAULT_SETTINGS, ...legacySource }, 5)
        : seed
        ? { ...DEFAULT_SETTINGS, ...seed }
        : { ...DEFAULT_SETTINGS };
      let migrationJournal: LegacyLanMigrationJournal | null = null;
      if (legacyLanMigrations.length > 0) {
        migrationJournal = createLegacyLanMigrationJournal(legacyLanMigrations);
        await AsyncStorage.setItem(
          LEGACY_LAN_MIGRATION_JOURNAL_KEY,
          JSON.stringify(migrationJournal)
        );
        await persistLegacyLanSecrets(legacyLanMigrations);
      }
      await this.saveConfig();
      await AsyncStorage.setItem(SETTINGS_SCHEMA_VERSION_KEY, String(SETTINGS_SCHEMA_VERSION));
      if (migrationJournal) {
        await this.retryLegacyLanCleanup(migrationJournal);
      }
    }
  }

  /**
   * 保存配置
   */
  private async saveConfig(config: AppSettings | null = this.config): Promise<void> {
    if (!config) {
      throw new Error('Config not initialized');
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (error) {
      log.error('Failed to save config:', error);
      throw error;
    }
  }

  private async retryLegacyLanCleanup(journal: LegacyLanMigrationJournal): Promise<void> {
    const allProfilesPersisted = journal.serverIds.every((serverId) =>
      this.config?.lanServers.some((server) => server.id === serverId)
    );
    if (!allProfilesPersisted) return;

    const storedSecrets = await Promise.all(
      journal.serverIds.map((serverId) => lanServerSecretStore.get(serverId))
    );
    if (storedSecrets.some((password) => !password)) return;

    try {
      await clearLegacyLanConfiguration();
      for (const key of journal.credentialStorageKeys) {
        await AsyncStorage.removeItem(key);
      }
      await AsyncStorage.removeItem(LEGACY_LAN_MIGRATION_JOURNAL_KEY);
    } catch (error) {
      log.warn('Legacy LAN cleanup will retry on next launch:', error);
    }
  }

  /**
   * 获取完整配置
   */
  public async getConfig(): Promise<AppSettings> {
    if (!this.initialized) {
      await this.initialize();
    }

    return { ...this.config! };
  }

  /**
   * 更新配置
   */
  public updateConfig(updates: Partial<AppSettings>): Promise<void> {
    const update = this.updateQueue.then(async () => {
      if (!this.initialized) {
        await this.initialize();
      }

      const nextConfig = { ...this.config!, ...updates };
      await AsyncStorage.setItem(CONFIG_USER_STATE_KEY, '1');
      await this.saveConfig(nextConfig);
      this.config = nextConfig;
    });

    // A failed write must reject its caller without poisoning later updates.
    this.updateQueue = update.catch(() => undefined);
    return update;
  }

  /**
   * 重置配置为默认值
   */
  public async resetConfig(): Promise<void> {
    this.config = { ...DEFAULT_SETTINGS };
    await this.saveConfig();
    await AsyncStorage.setItem(CONFIG_USER_STATE_KEY, '1');
  }

  // ========== 主题管理 ==========

  /**
   * 获取主题设置
   */
  public async getTheme(): Promise<'system' | 'light' | 'dark'> {
    const config = await this.getConfig();
    return config.appearance;
  }

  /**
   * 设置主题
   */
  public async setTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
    await this.updateConfig({ appearance: theme });
  }

  // ========== 通知设置管理 ==========

  /**
   * 是否启用通知
   */
  public async isNotificationsEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enableNotifications;
  }

  /**
   * 设置通知开关
   */
  public async setNotificationsEnabled(enabled: boolean): Promise<void> {
    await this.updateConfig({ enableNotifications: enabled });
  }

  // ========== 导入/导出 ==========

  /**
   * 导出配置为 JSON
   */
  public async exportConfig(): Promise<string> {
    const config = await this.getConfig();
    return JSON.stringify(config, null, 2);
  }

  /**
   * 从 JSON 导入配置
   */
  public async importConfig(json: string): Promise<void> {
    try {
      const imported = JSON.parse(json);

      this.config = imported as AppSettings;
      await this.saveConfig();
      await AsyncStorage.setItem(CONFIG_USER_STATE_KEY, '1');
    } catch (error) {
      log.error('Failed to import config:', error);
      throw new Error('Invalid config JSON');
    }
  }

  /**
   * 清空所有配置
   */
  public async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.CONFIG);
    await AsyncStorage.removeItem(CONFIG_USER_STATE_KEY);
    this.config = { ...DEFAULT_SETTINGS };
    this.initialized = false;
  }
}

// 导出单例
export const configStorage = ConfigStorage.getInstance();

function decodeLegacyPassword(encoded: string | null): string | null {
  if (!encoded) return null;
  try {
    return Base64.decode(encoded);
  } catch {
    return null;
  }
}

function createLegacyLanMigrationJournal(
  migrations: LegacyLanServerMigration[]
): LegacyLanMigrationJournal {
  return {
    version: 1,
    serverIds: migrations.map(({ profile }) => profile.id),
    credentialStorageKeys: [
      ...new Set(migrations.flatMap(({ credentialStorageKeys }) => credentialStorageKeys)),
    ],
  };
}

function parseLegacyLanMigrationJournal(json: string | null): LegacyLanMigrationJournal | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<LegacyLanMigrationJournal>;
    if (
      value.version !== 1 ||
      !Array.isArray(value.serverIds) ||
      !value.serverIds.every((id) => typeof id === 'string') ||
      !Array.isArray(value.credentialStorageKeys) ||
      !value.credentialStorageKeys.every((key) => typeof key === 'string')
    ) {
      return null;
    }
    return value as LegacyLanMigrationJournal;
  } catch {
    return null;
  }
}

async function persistLegacyLanSecrets(migrations: LegacyLanServerMigration[]): Promise<void> {
  for (const migration of migrations) {
    let encodedPassword: string | null = null;
    for (const key of migration.credentialStorageKeys) {
      encodedPassword = await AsyncStorage.getItem(key);
      if (encodedPassword) break;
    }
    const password = migration.inlinePassword ?? decodeLegacyPassword(encodedPassword);
    if (!password) {
      throw new Error(`Legacy LAN credentials are unavailable for ${migration.profile.id}`);
    }
    await lanServerSecretStore.set(migration.profile.id, password);
  }
}

function mergeLegacyLanSources(
  primary: unknown,
  native: LegacyLanConfigurationDTO | null
): Record<string, unknown> {
  const source = primary && typeof primary === 'object' ? (primary as Record<string, unknown>) : {};
  if (!native || getLegacyLanServerMigrations(source).length > 0) return source;
  return {
    ...source,
    servers: native.servers,
    activeServerIndex: native.activeServerIndex,
    trustInsecureCert: native.trustInsecureCert,
  };
}
