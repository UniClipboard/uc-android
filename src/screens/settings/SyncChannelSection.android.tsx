import { memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  Badge,
  HorizontalDivider,
  Icon,
  ListItem,
  RadioButton,
  Row,
  Spacer,
  Text as ComposeText,
} from '@expo/ui/jetpack-compose';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';
import { width } from '@expo/ui/jetpack-compose/modifiers';
import { useTranslation } from 'react-i18next';

import type { SettingsSubSection } from '@/navigation/AppNavigator';
import { useSettingsStore } from '@/stores';
import { SettingsSectionItem } from './SettingsSectionItem';
import { useSettingsToast } from './SettingsToastContext';

const CHEVRON = require('../../assets/icons/chevron_right.xml');

export const SyncChannelSection = memo(function SyncChannelSection() {
  const { t } = useTranslation('settings');
  const navigation = useNavigation<any>();
  const showMessage = useSettingsToast();
  const syncChannel = useSettingsStore((state) => state.config?.syncChannel ?? 'lan');
  const activeServer = useSettingsStore((state) => {
    const config = state.config;
    return config?.lanServers.find((server) => server.id === config.activeLanServerId) ?? null;
  });

  const handleSyncChannel = async (channel: 'lan' | 'p2p') => {
    if (channel === syncChannel) return;
    const result = await useSettingsStore.getState().updateConfig({ syncChannel: channel });
    if (!result.ok) showMessage(result.error || t('hub.clipboardSync.updateFailed'), 'error');
  };

  const openSection = (section: SettingsSubSection) => {
    navigation.navigate('SettingsSub', { section });
  };

  return (
    <>
      <SettingsSectionItem title={t('syncChannel.title')}>
        <ListItem modifiers={[clickable(() => void handleSyncChannel('lan'))]}>
          <ListItem.HeadlineContent>
            <ComposeText>{t('syncChannel.lan')}</ComposeText>
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <ComposeText>{t('syncChannel.default')}</ComposeText>
          </ListItem.SupportingContent>
          <ListItem.TrailingContent>
            <RadioButton selected={syncChannel === 'lan'} />
          </ListItem.TrailingContent>
        </ListItem>
        <HorizontalDivider />
        <ListItem modifiers={[clickable(() => void handleSyncChannel('p2p'))]}>
          <ListItem.HeadlineContent>
            <Row verticalAlignment="center">
              <ComposeText>{t('syncChannel.p2p')}</ComposeText>
              <Spacer modifiers={[width(8)]} />
              <Badge containerColor="#FF9500" contentColor="white">
                <ComposeText>{t('syncChannel.experimental')}</ComposeText>
              </Badge>
            </Row>
          </ListItem.HeadlineContent>
          <ListItem.TrailingContent>
            <RadioButton selected={syncChannel === 'p2p'} />
          </ListItem.TrailingContent>
        </ListItem>
      </SettingsSectionItem>

      <SettingsSectionItem title={t('syncChannel.currentConnection')}>
        {syncChannel === 'lan' ? (
          <ListItem modifiers={[clickable(() => openSection('lanServers'))]}>
            <ListItem.HeadlineContent>
              <ComposeText>{t('syncChannel.connectionSettings')}</ComposeText>
            </ListItem.HeadlineContent>
            <ListItem.SupportingContent>
              <ComposeText>
                {activeServer?.name || activeServer?.urls[0] || t('syncChannel.notConfigured')}
              </ComposeText>
            </ListItem.SupportingContent>
            <ListItem.TrailingContent>
              <Icon source={CHEVRON} size={20} />
            </ListItem.TrailingContent>
          </ListItem>
        ) : (
          <ListItem modifiers={[clickable(() => openSection('space'))]}>
            <ListItem.HeadlineContent>
              <ComposeText>{t('space.title', { ns: 'settingsSync' })}</ComposeText>
            </ListItem.HeadlineContent>
            <ListItem.TrailingContent>
              <Icon source={CHEVRON} size={20} />
            </ListItem.TrailingContent>
          </ListItem>
        )}
      </SettingsSectionItem>
    </>
  );
});
