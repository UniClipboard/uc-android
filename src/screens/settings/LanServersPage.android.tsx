import { useEffect, useState } from 'react';
import {
  AlertDialog,
  Button,
  Column,
  Icon,
  ListItem,
  ModalBottomSheet,
  OutlinedButton,
  Spacer,
  Text as ComposeText,
  TextButton,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  height as heightModifier,
  padding,
  verticalScroll,
  width as widthModifier,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTranslation } from 'react-i18next';

import { AppSwitch, AppTextField } from '@/components/ui';
import { useSettingsStore } from '@/features/settings';
import { usePendingLanConnectStore } from '@/features/lan-servers';
import { useLanServerEditor } from '@/features/lan-servers/useLanServerEditor';
import type { LanConnectIntent } from '@/features/lan-servers';
import { SettingsSectionItem } from './SettingsSectionItem';

const ICONS = {
  add: require('../../assets/icons/add.xml'),
  check: require('../../assets/icons/check_circle.xml'),
  chevron: require('../../assets/icons/chevron_right.xml'),
  server: require('../../assets/icons/dns.xml'),
};
const SHEET_TITLE_STYLE = { fontSize: 20, fontWeight: '600', letterSpacing: 0 } as const;

export function LanServersPage() {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  const servers = useSettingsStore((state) => state.config?.lanServers ?? []);
  const activeServerId = useSettingsStore((state) => state.config?.activeLanServerId ?? null);
  const pendingIntent = usePendingLanConnectStore((state) => state.intent);
  const consumePendingIntent = usePendingLanConnectStore((state) => state.consume);
  const [editingServerId, setEditingServerId] = useState<string | 'new' | null>(null);
  const [initialIntent, setInitialIntent] = useState<LanConnectIntent | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setConfirmDelete(false);
  };
  const editor = useLanServerEditor({
    visible: editingServerId !== null,
    serverId: editingServerId && editingServerId !== 'new' ? editingServerId : null,
    initialIntent,
    onFinished: closeEditor,
  });

  return (
    <Column modifiers={[fillMaxWidth()]}>
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

      {editingServerId !== null ? (
        <ModalBottomSheet onDismissRequest={closeEditor}>
          <Column modifiers={[fillMaxWidth(), padding(24, 8, 24, 24), verticalScroll()]}>
            <ComposeText style={SHEET_TITLE_STYLE}>
              {editingServerId === 'new' ? t('lan.add') : t('lan.edit')}
            </ComposeText>
            <Spacer modifiers={[heightModifier(16)]} />
            <Button onClick={editor.openScanner} modifiers={[fillMaxWidth()]}>
              <ComposeText>{t('lan.scan')}</ComposeText>
            </Button>
            <Spacer modifiers={[heightModifier(16)]} />
            <AppTextField
              value={editor.name}
              onChangeText={editor.setName}
              label={t('lan.name')}
              placeholder={t('lan.namePlaceholder')}
              fullWidth
            />
            <Spacer modifiers={[heightModifier(12)]} />
            {editor.urls.map((url, index) => (
              <Column key={`lan-url-${index}`} modifiers={[fillMaxWidth()]}>
                <AppTextField
                  value={url}
                  onChangeText={(value) => editor.updateUrl(index, value)}
                  label={index === 0 ? t('lan.addresses') : undefined}
                  placeholder="http://192.168.1.5:42720"
                  keyboardType="uri"
                  fullWidth
                />
                {editor.urls.length > 1 ? (
                  <TextButton onClick={() => editor.removeUrl(index)}>
                    <ComposeText color={colors.error}>{t('lan.removeAddress')}</ComposeText>
                  </TextButton>
                ) : null}
                <Spacer modifiers={[heightModifier(8)]} />
              </Column>
            ))}
            <TextButton onClick={editor.addUrl} modifiers={[fillMaxWidth()]}>
              <Icon source={ICONS.add} size={18} tint={colors.primary} />
              <Spacer modifiers={[widthModifier(8)]} />
              <ComposeText>{t('lan.addAddress')}</ComposeText>
            </TextButton>
            <Spacer modifiers={[heightModifier(12)]} />
            <AppTextField
              value={editor.username}
              onChangeText={editor.setUsername}
              label={t('lan.username')}
              fullWidth
            />
            <Spacer modifiers={[heightModifier(12)]} />
            <AppTextField
              value={editor.password}
              onChangeText={editor.setPassword}
              label={t('lan.password')}
              secure
              fullWidth
            />
            <Spacer modifiers={[heightModifier(16)]} />
            <ListItem>
              <ListItem.HeadlineContent>
                <ComposeText>{t('lan.allowInsecureTls')}</ComposeText>
              </ListItem.HeadlineContent>
              <ListItem.TrailingContent>
                <AppSwitch
                  value={editor.allowInsecureTls}
                  onValueChange={editor.setAllowInsecureTls}
                />
              </ListItem.TrailingContent>
            </ListItem>
            {editor.error ? <ComposeText color={colors.error}>{editor.error}</ComposeText> : null}
            <Spacer modifiers={[heightModifier(20)]} />
            <Button
              onClick={() => void editor.save()}
              enabled={!editor.pending && editor.canSave}
              modifiers={[fillMaxWidth()]}
            >
              <ComposeText>{t('action.save', { ns: 'common' })}</ComposeText>
            </Button>
            {editingServerId !== 'new' && !editor.isActive ? (
              <TextButton
                onClick={() => void editor.select()}
                enabled={!editor.pending}
                modifiers={[fillMaxWidth()]}
              >
                <ComposeText>{t('lan.makeActive')}</ComposeText>
              </TextButton>
            ) : null}
            {editingServerId !== 'new' ? (
              <OutlinedButton
                onClick={() => setConfirmDelete(true)}
                enabled={!editor.pending}
                modifiers={[fillMaxWidth()]}
              >
                <ComposeText color={colors.error}>
                  {t('action.delete', { ns: 'common' })}
                </ComposeText>
              </OutlinedButton>
            ) : null}
            <TextButton onClick={closeEditor} modifiers={[fillMaxWidth()]}>
              <ComposeText>{t('action.cancel', { ns: 'common' })}</ComposeText>
            </TextButton>
          </Column>
        </ModalBottomSheet>
      ) : null}

      {confirmDelete ? (
        <AlertDialog onDismissRequest={() => setConfirmDelete(false)}>
          <AlertDialog.Title>
            <ComposeText>{t('lan.deleteTitle')}</ComposeText>
          </AlertDialog.Title>
          <AlertDialog.Text>
            <ComposeText>{t('lan.deleteMessage')}</ComposeText>
          </AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <TextButton
              onClick={() => {
                setConfirmDelete(false);
                void editor.remove();
              }}
            >
              <ComposeText color={colors.error}>{t('action.delete', { ns: 'common' })}</ComposeText>
            </TextButton>
          </AlertDialog.ConfirmButton>
          <AlertDialog.DismissButton>
            <TextButton onClick={() => setConfirmDelete(false)}>
              <ComposeText>{t('action.cancel', { ns: 'common' })}</ComposeText>
            </TextButton>
          </AlertDialog.DismissButton>
        </AlertDialog>
      ) : null}
    </Column>
  );
}
