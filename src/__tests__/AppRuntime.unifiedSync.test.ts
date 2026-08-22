import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { configureAppRuntime, getAppRuntime } from '../app/runtime';

let appStateListener: ((state: 'active' | 'background' | 'inactive') => void) | null = null;

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_event: string, listener: typeof appStateListener) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    }),
  },
  Platform: { OS: 'android' },
}));

const sync = {
  start: jest.fn(async () => undefined),
  refresh: jest.fn(async () => undefined),
  handleAppStateChange: jest.fn(),
  switchTo: jest.fn(async () => undefined),
};

configureAppRuntime({
  settingsStore: {
    getState: () => ({
      isLoaded: true,
      config: { enableForegroundNotification: false },
      isTempDisabledBackgroundTasks: false,
      loadConfig: jest.fn(async () => undefined),
      setEnableBackgroundTasks: jest.fn(),
      setTempDisabledBackgroundTasks: jest.fn(),
    }),
    subscribe: jest.fn(() => jest.fn()),
  },
  clipboardStore: { getState: () => ({ startMonitoring: jest.fn(async () => undefined) }) },
  sync: () => sync,
  statisticsStore: {
    getState: () => ({
      recordBackgroundTaskStart: jest.fn(async () => undefined),
      updateHeartbeat: jest.fn(),
    }),
  },
  applicationVersion: () => '2.0.0.179-alpha.3',
});

describe('AppRuntime unified sync ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts and refreshes through the unified sync runtime', async () => {
    await getAppRuntime().start();

    expect(sync.start).toHaveBeenCalledWith({
      appVersion: '2.0.0-alpha.3+build.179',
      profileId: 'default',
      policy: { appState: 'active', backgroundSyncEnabled: false },
    });

    appStateListener?.('inactive');
    expect(sync.handleAppStateChange).toHaveBeenCalledWith({
      appState: 'inactive',
      backgroundSyncEnabled: false,
    });

    appStateListener?.('active');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sync.refresh).toHaveBeenCalledWith({
      appState: 'active',
      backgroundSyncEnabled: false,
    });
  });
});
