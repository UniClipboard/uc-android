import React, { useEffect, useState } from 'react';
import {
  Column,
  Icon,
  ListItem,
  Text as ComposeText,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { LanServerEditorSheet } from './LanServerEditorSheet';
import { MySpaceLayout } from './MySpaceLayout';
import type { MySpaceSheetProps } from './MySpaceSheet.types';
import {
  useLanMySpaceSheet,
  type LanMySpaceServerStatus,
  type LanMySpaceServerView,
} from './useLanMySpaceSheet';

const ICONS = {
  add: require('../assets/icons/add.xml'),
  check: require('../assets/icons/check_circle.xml'),
  chevron: require('../assets/icons/chevron_right.xml'),
  status: require('../assets/icons/circle.xml'),
};
const SECTION_STYLE = { fontSize: 13, fontWeight: '600', letterSpacing: 0 } as const;

export function LanMySpaceContent({ visible, onClose }: MySpaceSheetProps) {
  const { t } = useTranslation(['home', 'settings', 'settingsSync']);
  const colors = useMaterialColors();
  const { servers, isUnconfigured, isRefreshing, refresh } = useLanMySpaceSheet(visible);
  const [editingServerId, setEditingServerId] = useState<string | 'new' | null>(null);

  useEffect(() => {
    if (!visible) setEditingServerId(null);
  }, [visible]);

  const activeServer = servers.find((server) => server.isActive) ?? null;
  const otherServers = servers.filter((server) => !server.isActive);
  const contentHeight = Math.min(Math.max(servers.length * 80 + 144, 240), 520);

  return (
    <MySpaceLayout
      visible={visible}
      onClose={onClose}
      title={t('topBar.mySpace', { ns: 'home' })}
      actionLabel={t('lan.add', { ns: 'settingsSync' })}
      onAction={() => setEditingServerId('new')}
      actionPending={false}
      actionEnabled
      isRefreshing={isRefreshing}
      onRefresh={refresh}
      contentHeight={contentHeight}
      supplementary={
        <LanServerEditorSheet
          visible={editingServerId !== null}
          serverId={editingServerId && editingServerId !== 'new' ? editingServerId : null}
          selectAfterSave={editingServerId === 'new'}
          onClose={() => setEditingServerId(null)}
        />
      }
    >
      {isUnconfigured ? (
        <ListItem modifiers={[clickable(() => setEditingServerId('new'))]}>
          <ListItem.LeadingContent>
            <Icon source={ICONS.add} size={24} tint={colors.primary} />
          </ListItem.LeadingContent>
          <ListItem.HeadlineContent>
            <ComposeText>{t('lan.add', { ns: 'settingsSync' })}</ComposeText>
          </ListItem.HeadlineContent>
          <ListItem.SupportingContent>
            <ComposeText color={colors.onSurfaceVariant}>
              {t('syncChannel.notConfigured', { ns: 'settings' })}
            </ComposeText>
          </ListItem.SupportingContent>
        </ListItem>
      ) : null}

      {activeServer ? (
        <Column>
          <ComposeText style={SECTION_STYLE} color={colors.onSurfaceVariant}>
            {t('syncChannel.currentConnection', { ns: 'settings' })}
          </ComposeText>
          <LanServerRow server={activeServer} onPress={() => setEditingServerId(activeServer.id)} />
        </Column>
      ) : null}

      {otherServers.length > 0 ? (
        <Column>
          <ComposeText style={SECTION_STYLE} color={colors.onSurfaceVariant}>
            {t('lan.title', { ns: 'settingsSync' })}
          </ComposeText>
          {otherServers.map((server) => (
            <LanServerRow
              key={server.id}
              server={server}
              onPress={() => setEditingServerId(server.id)}
            />
          ))}
        </Column>
      ) : null}
    </MySpaceLayout>
  );
}

function LanServerRow({ server, onPress }: { server: LanMySpaceServerView; onPress(): void }) {
  const { t } = useTranslation(['common', 'settingsSync']);
  const colors = useMaterialColors();
  const statusColor =
    server.status === 'online'
      ? colors.primary
      : server.status === 'authFailed'
      ? colors.error
      : colors.outline;
  return (
    <ListItem modifiers={[clickable(onPress)]}>
      <ListItem.LeadingContent>
        <Icon source={ICONS.status} size={10} tint={statusColor} />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <ComposeText>{server.name}</ComposeText>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Column>
          <ComposeText color={colors.onSurfaceVariant}>{server.address}</ComposeText>
          <ComposeText color={statusColor}>{statusLabel(server.status, t)}</ComposeText>
        </Column>
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        <Icon
          source={server.isActive ? ICONS.check : ICONS.chevron}
          size={20}
          tint={server.isActive ? colors.primary : colors.onSurfaceVariant}
        />
      </ListItem.TrailingContent>
    </ListItem>
  );
}

function statusLabel(status: LanMySpaceServerStatus, t: TFunction) {
  if (status === 'online') return t('lan.probe.results.Success', { ns: 'settingsSync' });
  if (status === 'authFailed') return t('lan.probe.results.AuthFailed', { ns: 'settingsSync' });
  if (status === 'offline') return t('lan.probe.results.Unreachable', { ns: 'settingsSync' });
  return t('state.loading', { ns: 'common' });
}
