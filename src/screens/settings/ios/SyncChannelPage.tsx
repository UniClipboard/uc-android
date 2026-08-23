import { Section, Text as SwiftUIText } from '@expo/ui/swift-ui';
import { useTranslation } from 'react-i18next';

import { IosSheetForm, IosSheetPage } from '@/components/ui';
import { useSettingsStore } from '@/stores';
import type { SettingsPage } from './types';
import { HeaderCircleButton, SettingsNavRow, settingsTileColors } from './common';

export function SyncChannelPage({
  onBack,
  onNavigate,
}: {
  onBack(): void;
  onNavigate(page: SettingsPage): void;
}) {
  const { t } = useTranslation('settings');
  const syncChannel = useSettingsStore((state) => state.config?.syncChannel ?? 'lan');
  const activeServer = useSettingsStore((state) => {
    const config = state.config;
    return config?.lanServers.find((server) => server.id === config.activeLanServerId) ?? null;
  });

  const handleSyncChannel = async (channel: 'lan' | 'p2p') => {
    if (channel === syncChannel) return;
    await useSettingsStore.getState().updateConfig({ syncChannel: channel });
  };

  return (
    <IosSheetPage
      title={t('syncChannel.title')}
      leftSlots={[<HeaderCircleButton key="back" systemName="chevron.left" onPress={onBack} />]}
    >
      <IosSheetForm>
        <Section>
          <SettingsNavRow
            title={t('syncChannel.lan')}
            value={t('syncChannel.default')}
            selected={syncChannel === 'lan'}
            showsChevron={false}
            showsPressFeedback={false}
            onPress={() => void handleSyncChannel('lan')}
          />
          <SettingsNavRow
            title={t('syncChannel.p2p')}
            badge={t('syncChannel.experimental')}
            selected={syncChannel === 'p2p'}
            showsChevron={false}
            showsPressFeedback={false}
            onPress={() => void handleSyncChannel('p2p')}
          />
        </Section>

        <Section header={<SwiftUIText>{t('syncChannel.currentConnection')}</SwiftUIText>}>
          {syncChannel === 'lan' ? (
            <SettingsNavRow
              icon="server.rack"
              iconColor={settingsTileColors.blue}
              title={t('syncChannel.connectionSettings')}
              value={activeServer?.name || activeServer?.urls[0] || t('syncChannel.notConfigured')}
              onPress={() => onNavigate('lanServers')}
            />
          ) : (
            <SettingsNavRow
              icon="person.2"
              iconColor={settingsTileColors.indigo}
              title={t('space.title', { ns: 'settingsSync' })}
              onPress={() => onNavigate('space')}
            />
          )}
        </Section>
      </IosSheetForm>
    </IosSheetPage>
  );
}
