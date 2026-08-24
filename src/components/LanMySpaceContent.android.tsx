import React, { useEffect, useState } from 'react';
import {
  Column,
  HorizontalDivider,
  Icon,
  ListItem,
  Row,
  Shape,
  Spacer,
  Surface,
  Text as ComposeText,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  height,
  padding,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
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
  chevron: require('../assets/icons/chevron_right.xml'),
  status: require('../assets/icons/circle.xml'),
};
const SECTION_STYLE = { fontSize: 13, fontWeight: '600', letterSpacing: 0 } as const;
const SERVER_LIST_SHAPE = Shape.RoundedCorner({
  cornerRadii: { topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 16 },
});

export function LanMySpaceContent({ visible, onClose }: MySpaceSheetProps) {
  const { t } = useTranslation(['home', 'settings', 'settingsSync']);
  const colors = useMaterialColors();
  const { servers, isUnconfigured } = useLanMySpaceSheet(visible);
  const [editingServerId, setEditingServerId] = useState<string | 'new' | null>(null);

  useEffect(() => {
    if (!visible) setEditingServerId(null);
  }, [visible]);

  const sectionCount = Number(servers.length > 0);
  const contentHeight = Math.min(
    Math.max(
      servers.length * 88 + sectionCount * 24 + Math.max(sectionCount - 1, 0) * 12 + 20,
      112
    ),
    520
  );

  return (
    <MySpaceLayout
      visible={visible}
      onClose={onClose}
      title={t('topBar.mySpace', { ns: 'home' })}
      actionLabel={t('lan.add', { ns: 'settingsSync' })}
      onAction={() => setEditingServerId('new')}
      actionPending={false}
      actionEnabled
      contentHeight={contentHeight}
      supplementary={
        <LanServerEditorSheet
          visible={editingServerId !== null}
          serverId={editingServerId && editingServerId !== 'new' ? editingServerId : null}
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

      {servers.length > 0 ? (
        <Column modifiers={[fillMaxWidth()]}>
          <ComposeText style={SECTION_STYLE} color={colors.onSurfaceVariant}>
            {t('lan.title', { ns: 'settingsSync' })}
          </ComposeText>
          <Spacer modifiers={[height(6)]} />
          <Surface
            color={colors.surfaceContainerLow}
            border={{ color: colors.outlineVariant }}
            shape={SERVER_LIST_SHAPE}
            modifiers={[fillMaxWidth()]}
          >
            <Column>
              {servers.map((server, index) => (
                <React.Fragment key={server.id}>
                  <LanServerRow server={server} onPress={() => setEditingServerId(server.id)} />
                  {index < servers.length - 1 ? (
                    <HorizontalDivider color={colors.outlineVariant} modifiers={[fillMaxWidth()]} />
                  ) : null}
                </React.Fragment>
              ))}
            </Column>
          </Surface>
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
    <Row
      verticalAlignment="center"
      modifiers={[fillMaxWidth(), clickable(onPress), padding(16, 12, 16, 12)]}
    >
      <Icon source={ICONS.status} size={10} tint={statusColor} />
      <Spacer modifiers={[width(16)]} />
      <Column modifiers={[weight(1)]}>
        <ComposeText color={colors.onSurface}>{server.name}</ComposeText>
        <ComposeText color={colors.onSurfaceVariant}>{server.address}</ComposeText>
        <ComposeText color={statusColor}>{statusLabel(server.status, t)}</ComposeText>
      </Column>
      <Spacer modifiers={[width(12)]} />
      <Icon source={ICONS.chevron} size={20} tint={colors.onSurfaceVariant} />
    </Row>
  );
}

function statusLabel(status: LanMySpaceServerStatus, t: TFunction) {
  if (status === 'online') return t('lan.probe.results.Success', { ns: 'settingsSync' });
  if (status === 'authFailed') return t('lan.probe.results.AuthFailed', { ns: 'settingsSync' });
  if (status === 'offline') return t('lan.probe.results.Unreachable', { ns: 'settingsSync' });
  return t('state.loading', { ns: 'common' });
}
