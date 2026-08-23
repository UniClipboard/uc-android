import React, { useEffect, useState } from 'react';
import {
  Button as SwiftUIButton,
  HStack,
  Image,
  Section,
  Spacer,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  onTapGesture,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { LanServerEditorSheet } from './LanServerEditorSheet.ios';
import { MySpaceLayout } from './MySpaceLayout.ios';
import type { MySpaceSheetProps } from './MySpaceSheet.types';
import {
  useLanMySpaceSheet,
  type LanMySpaceServerStatus,
  type LanMySpaceServerView,
} from './useLanMySpaceSheet';

const ONLINE_COLOR = '#34C759';
const OFFLINE_COLOR = '#8E8E93';
const ERROR_COLOR = '#FF3B30';

export function LanMySpaceContent({ visible, onClose }: MySpaceSheetProps) {
  const { t } = useTranslation(['home', 'settings', 'settingsSync']);
  const { servers, isUnconfigured, isRefreshing, refresh } = useLanMySpaceSheet(visible);
  const [editingServerId, setEditingServerId] = useState<string | 'new' | null>(null);

  useEffect(() => {
    if (!visible) setEditingServerId(null);
  }, [visible]);

  const activeServer = servers.find((server) => server.isActive) ?? null;
  const otherServers = servers.filter((server) => !server.isActive);
  const editorPage =
    editingServerId !== null ? (
      <LanServerEditorSheet
        visible
        embedded
        serverId={editingServerId !== 'new' ? editingServerId : null}
        selectAfterSave={editingServerId === 'new'}
        onClose={() => setEditingServerId(null)}
      />
    ) : undefined;

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
      prefersLarge={Boolean(editorPage)}
      page={editorPage}
    >
      {isUnconfigured ? (
        <Section>
          <SwiftUIButton
            onPress={() => setEditingServerId('new')}
            modifiers={[buttonStyle('plain')]}
          >
            <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
              <Image systemName="plus.circle.fill" size={20} color={ONLINE_COLOR} />
              <VStack alignment="leading" spacing={3}>
                <SwiftUIText>{t('lan.add', { ns: 'settingsSync' })}</SwiftUIText>
                <SwiftUIText modifiers={[font({ size: 13 }), foregroundStyle('secondary')]}>
                  {t('syncChannel.notConfigured', { ns: 'settings' })}
                </SwiftUIText>
              </VStack>
              <Spacer />
            </HStack>
          </SwiftUIButton>
        </Section>
      ) : null}

      {activeServer ? (
        <Section
          header={
            <SwiftUIText>{t('syncChannel.currentConnection', { ns: 'settings' })}</SwiftUIText>
          }
        >
          <LanServerRow server={activeServer} onPress={() => setEditingServerId(activeServer.id)} />
        </Section>
      ) : null}

      {otherServers.length > 0 ? (
        <Section header={<SwiftUIText>{t('lan.title', { ns: 'settingsSync' })}</SwiftUIText>}>
          {otherServers.map((server) => (
            <LanServerRow
              key={server.id}
              server={server}
              onPress={() => setEditingServerId(server.id)}
            />
          ))}
        </Section>
      ) : null}
    </MySpaceLayout>
  );
}

function LanServerRow({ server, onPress }: { server: LanMySpaceServerView; onPress(): void }) {
  const { t } = useTranslation(['common', 'settingsSync']);
  const statusColor =
    server.status === 'online'
      ? ONLINE_COLOR
      : server.status === 'authFailed'
      ? ERROR_COLOR
      : OFFLINE_COLOR;
  return (
    <HStack
      spacing={12}
      alignment="center"
      modifiers={[
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        onTapGesture(onPress),
      ]}
    >
      <Image systemName="circle.fill" size={8} color={statusColor} />
      <VStack alignment="leading" spacing={3}>
        <SwiftUIText modifiers={[font({ weight: 'semibold' })]}>{server.name}</SwiftUIText>
        <SwiftUIText modifiers={[font({ size: 13 }), foregroundStyle('secondary')]}>
          {server.address}
        </SwiftUIText>
        <SwiftUIText modifiers={[font({ size: 12 }), foregroundStyle(statusColor)]}>
          {statusLabel(server.status, t)}
        </SwiftUIText>
      </VStack>
      <Spacer />
      <Image
        systemName={server.isActive ? 'checkmark' : 'chevron.right'}
        size={13}
        color={server.isActive ? ONLINE_COLOR : OFFLINE_COLOR}
      />
    </HStack>
  );
}

function statusLabel(status: LanMySpaceServerStatus, t: TFunction) {
  if (status === 'online') return t('lan.probe.results.Success', { ns: 'settingsSync' });
  if (status === 'authFailed') return t('lan.probe.results.AuthFailed', { ns: 'settingsSync' });
  if (status === 'offline') return t('lan.probe.results.Unreachable', { ns: 'settingsSync' });
  return t('state.loading', { ns: 'common' });
}
