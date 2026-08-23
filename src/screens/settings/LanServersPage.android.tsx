import { useEffect, useState } from 'react';
import { Icon, ListItem, Text as ComposeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';
import { useTranslation } from 'react-i18next';

import { LanServerEditorSheet } from '@/components/LanServerEditorSheet';
import { usePendingLanConnectStore, type LanConnectIntent } from '@/features/lan-servers';
import { useSettingsStore } from '@/features/settings';
import { SettingsSectionItem } from './SettingsSectionItem';

const ICONS = {
  add: require('../../assets/icons/add.xml'),
  check: require('../../assets/icons/check_circle.xml'),
  chevron: require('../../assets/icons/chevron_right.xml'),
  server: require('../../assets/icons/dns.xml'),
};

export function LanServersPage() {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  const servers = useSettingsStore((state) => state.config?.lanServers ?? []);
  const activeServerId = useSettingsStore((state) => state.config?.activeLanServerId ?? null);
  const pendingIntent = usePendingLanConnectStore((state) => state.intent);
  const consumePendingIntent = usePendingLanConnectStore((state) => state.consume);
  const [editingServerId, setEditingServerId] = useState<string | 'new' | null>(null);
  const [initialIntent, setInitialIntent] = useState<LanConnectIntent | null>(null);

  useEffect(() => {
    if (!pendingIntent) return;
    const intent = consumePendingIntent();
    if (!intent) return;
    setInitialIntent(intent);
    setEditingServerId('new');
  }, [consumePendingIntent, pendingIntent]);

  const closeEditor = () => {
    setEditingServerId(null);
    setInitialIntent(null);
  };

  return (
    <>
      <SettingsSectionItem title={t('lan.title')} footer={t('lan.notAvailableYet')}>
        {servers.length === 0 ? (
          <ListItem modifiers={[clickable(() => setEditingServerId('new'))]}>
            <ListItem.LeadingContent>
              <Icon source={ICONS.add} size={24} tint={colors.primary} />
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              <ComposeText>{t('lan.add')}</ComposeText>
            </ListItem.HeadlineContent>
          </ListItem>
        ) : (
          <>
            {servers.map((server) => (
              <ListItem
                key={server.id}
                modifiers={[clickable(() => setEditingServerId(server.id))]}
              >
                <ListItem.LeadingContent>
                  <Icon
                    source={server.id === activeServerId ? ICONS.check : ICONS.server}
                    size={24}
                    tint={server.id === activeServerId ? colors.primary : colors.onSurfaceVariant}
                  />
                </ListItem.LeadingContent>
                <ListItem.HeadlineContent>
                  <ComposeText>{server.name || server.urls[0]}</ComposeText>
                </ListItem.HeadlineContent>
                <ListItem.SupportingContent>
                  <ComposeText color={colors.onSurfaceVariant}>{server.urls[0]}</ComposeText>
                </ListItem.SupportingContent>
                <ListItem.TrailingContent>
                  <Icon source={ICONS.chevron} size={20} tint={colors.onSurfaceVariant} />
                </ListItem.TrailingContent>
              </ListItem>
            ))}
            <ListItem modifiers={[clickable(() => setEditingServerId('new'))]}>
              <ListItem.LeadingContent>
                <Icon source={ICONS.add} size={24} tint={colors.primary} />
              </ListItem.LeadingContent>
              <ListItem.HeadlineContent>
                <ComposeText>{t('lan.add')}</ComposeText>
              </ListItem.HeadlineContent>
            </ListItem>
          </>
        )}
      </SettingsSectionItem>
      <LanServerEditorSheet
        visible={editingServerId !== null}
        serverId={editingServerId && editingServerId !== 'new' ? editingServerId : null}
        initialIntent={initialIntent}
        onClose={closeEditor}
      />
    </>
  );
}
