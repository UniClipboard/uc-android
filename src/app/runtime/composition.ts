import { File } from 'expo-file-system';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import {
  configureP2pSpaceActivation,
  getP2pSpaceSetupCoordinator,
} from './p2pSpaceSetupCoordinator';
import {
  configureAppRuntime as configureRuntimeDependencies,
  getAppRuntime as getUnconfiguredAppRuntime,
} from './appRuntime';
import { nativeEngine } from '@/platform/engine/nativeEngine';
import { configureUnifiedEngineService, getUnifiedEngineService } from '@/platform/engine';
import { configureUnifiedSpaceService, getUnifiedSpaceService } from '@/features/space';
import {
  configureClipboardObserver,
  configureOutboundDeliveryCoordinator,
  configureUnifiedContentService,
  getUnifiedContentService,
  getOutboundDeliveryCoordinator,
} from '@/features/transfer';
import { clipboardManager, useClipboardStore } from '@/features/clipboard';
import { persistP2pDeliveryReport } from '@/features/transfer';
import { configureAnalyticsConsent, useSettingsStore } from '@/features/settings';
import { configureRelaySettings } from '@/features/relaySettings';
import { configureNetworkContextChangeListener } from '@/platform/network';
import { configurePostHogAnalytics } from '@/support/observability';
import { useStatisticsStore } from '@/stores/statisticsStore';
import { configureOutboundShareHandoffManager, createPendingShareStore } from '@/features/transfer';
import {
  configureUnifiedSyncRuntime,
  getUnifiedSyncRuntime,
  P2pSyncAdapter,
} from '@/features/sync';
import { configureProductionLanServerService } from '@/features/lan-servers/production';
import { getLanServerService } from '@/features/lan-servers';
import { LanSyncAdapter } from '@/features/lan-sync';
import { applyLanRemoteText } from '@/features/lan-sync/production';

let configured = false;

export function configureAppRuntime(): void {
  if (configured) return;

  configureUnifiedEngineService(nativeEngine);
  configureProductionLanServerService();
  configureOutboundDeliveryCoordinator(getUnifiedEngineService());
  configureUnifiedContentService({
    readClipboard: () => clipboardManager.getClipboardContent(),
    readFileBytes: (uri) => new File(uri).bytes(),
    p2p: nativeEngine,
    completeOutboundDelivery: (send) => getOutboundDeliveryCoordinator().run(send),
    persistDelivery: persistP2pDeliveryReport,
  });
  configureOutboundShareHandoffManager(createPendingShareStore());
  configureClipboardObserver((content, dispatch) =>
    getUnifiedSyncRuntime().observeClipboardChange(content, dispatch)
  );
  configureP2pSpaceActivation(() => getUnconfiguredAppRuntime().activateP2p());
  configureUnifiedSpaceService(nativeEngine, (operation) =>
    getP2pSpaceSetupCoordinator().run(operation)
  );
  configureUnifiedSyncRuntime(
    [
      new P2pSyncAdapter({
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        engine: getUnifiedEngineService(),
        space: getUnifiedSpaceService(),
        content: getUnifiedContentService(),
        clipboard: {
          observeClipboardChange: (dispatch) => nativeEngine.observeClipboardChange(dispatch),
          persistDelivery: persistP2pDeliveryReport,
        },
      }),
      new LanSyncAdapter({
        async getActiveServer() {
          const config = useSettingsStore.getState().config;
          if (!config?.activeLanServerId) return null;
          return getLanServerService().getDraft(config.activeLanServerId);
        },
        readClipboard: () => clipboardManager.getClipboardContent(),
        applyRemoteText: applyLanRemoteText,
      }),
    ],
    'p2p'
  );
  configureAnalyticsConsent(nativeEngine);
  configureRelaySettings({
    saveCustomRelayNode: nativeEngine.saveCustomRelayNode,
    async rebuildRelayEndpoint(): Promise<void> {
      await getUnifiedSyncRuntime().restart();
    },
  });
  configurePostHogAnalytics({
    loadState: () => nativeEngine.getAnalyticsState(),
    subscribe: (listener) => nativeEngine.subscribeAnalyticsState(listener),
  });
  configureNetworkContextChangeListener(() => {
    void getUnconfiguredAppRuntime().refresh();
  });
  configureRuntimeDependencies({
    settingsStore: useSettingsStore,
    clipboardStore: useClipboardStore,
    sync: getUnifiedSyncRuntime,
    statisticsStore: useStatisticsStore,
    applicationVersion: () => Application.nativeApplicationVersion ?? null,
  });
  configured = true;
}

export function getAppRuntime() {
  configureAppRuntime();
  return getUnconfiguredAppRuntime();
}
