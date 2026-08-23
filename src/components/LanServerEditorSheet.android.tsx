import { useState } from 'react';
import {
  AlertDialog,
  Button,
  CircularProgressIndicator,
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
  fillMaxWidth,
  height,
  padding,
  verticalScroll,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTranslation } from 'react-i18next';

import { AppSwitch, AppTextField } from '@/components/ui';
import { useLanServerEditor } from '@/features/lan-servers/useLanServerEditor';
import type { LanServerEditorSheetProps } from './LanServerEditorSheet.types';

const ICONS = {
  add: require('../assets/icons/add.xml'),
  check: require('../assets/icons/check_circle.xml'),
  unavailable: require('../assets/icons/close.xml'),
  wifi: require('../assets/icons/wifi.xml'),
};
const TITLE_STYLE = { fontSize: 20, fontWeight: '600', letterSpacing: 0 } as const;

export function LanServerEditorSheet(props: LanServerEditorSheetProps) {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editor = useLanServerEditor({
    visible: props.visible,
    serverId: props.serverId,
    initialIntent: props.initialIntent,
    selectAfterSave: props.selectAfterSave,
    onFinished: props.onClose,
  });

  if (!props.visible) return null;

  return (
    <>
      <ModalBottomSheet onDismissRequest={props.onClose}>
        <Column modifiers={[fillMaxWidth(), padding(24, 8, 24, 24), verticalScroll()]}>
          <ComposeText style={TITLE_STYLE}>
            {props.serverId ? t('lan.edit') : t('lan.add')}
          </ComposeText>
          <Spacer modifiers={[height(16)]} />
          <Button onClick={editor.openScanner} modifiers={[fillMaxWidth()]}>
            <ComposeText>{t('lan.scan')}</ComposeText>
          </Button>
          <Spacer modifiers={[height(16)]} />
          <AppTextField
            value={editor.name}
            onChangeText={editor.setName}
            label={t('lan.name')}
            placeholder={t('lan.namePlaceholder')}
            fullWidth
          />
          <Spacer modifiers={[height(12)]} />
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
              <Spacer modifiers={[height(8)]} />
            </Column>
          ))}
          <TextButton onClick={editor.addUrl} modifiers={[fillMaxWidth()]}>
            <Icon source={ICONS.add} size={18} tint={colors.primary} />
            <Spacer modifiers={[width(8)]} />
            <ComposeText>{t('lan.addAddress')}</ComposeText>
          </TextButton>
          <Spacer modifiers={[height(12)]} />
          <AppTextField
            value={editor.username}
            onChangeText={editor.setUsername}
            label={t('lan.username')}
            fullWidth
          />
          <Spacer modifiers={[height(12)]} />
          <AppTextField
            value={editor.password}
            onChangeText={editor.setPassword}
            label={t('lan.password')}
            secure
            fullWidth
          />
          <Spacer modifiers={[height(16)]} />
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
          <Spacer modifiers={[height(16)]} />
          <ComposeText style={TITLE_STYLE}>{t('lan.probe.section')}</ComposeText>
          <Spacer modifiers={[height(8)]} />
          {editor.probeResults
            ? editor.urls.map((url, index) => {
                const candidate = url.trim();
                const result = editor.probeResults?.[candidate];
                if (!candidate || !result) return null;
                return (
                  <ListItem key={`lan-probe-${index}`}>
                    <ListItem.LeadingContent>
                      <Icon
                        source={result === 'Success' ? ICONS.check : ICONS.unavailable}
                        size={20}
                        tint={result === 'Success' ? colors.primary : colors.error}
                      />
                    </ListItem.LeadingContent>
                    <ListItem.HeadlineContent>
                      <ComposeText>{candidate}</ComposeText>
                    </ListItem.HeadlineContent>
                    <ListItem.SupportingContent>
                      <ComposeText color={colors.onSurfaceVariant}>
                        {t(`lan.probe.results.${result}`)}
                        {candidate === editor.preferredProbeUrl
                          ? ` · ${t('lan.probe.willUse')}`
                          : ''}
                      </ComposeText>
                    </ListItem.SupportingContent>
                  </ListItem>
                );
              })
            : null}
          {editor.isProbing ? (
            <CircularProgressIndicator />
          ) : (
            <Button
              onClick={() => void editor.probe()}
              enabled={editor.urls.some((url) => url.trim())}
              modifiers={[fillMaxWidth()]}
            >
              <Icon source={ICONS.wifi} size={18} tint={colors.onPrimary} />
              <Spacer modifiers={[width(8)]} />
              <ComposeText>
                {editor.probeResults ? t('lan.probe.retest') : t('lan.probe.test')}
              </ComposeText>
            </Button>
          )}
          {editor.error ? <ComposeText color={colors.error}>{editor.error}</ComposeText> : null}
          <Spacer modifiers={[height(20)]} />
          <Button
            onClick={() => void editor.save()}
            enabled={!editor.pending && editor.canSave}
            modifiers={[fillMaxWidth()]}
          >
            <ComposeText>{t('action.save', { ns: 'common' })}</ComposeText>
          </Button>
          {props.serverId && !editor.isActive ? (
            <TextButton
              onClick={() => void editor.select()}
              enabled={!editor.pending}
              modifiers={[fillMaxWidth()]}
            >
              <ComposeText>{t('lan.makeActive')}</ComposeText>
            </TextButton>
          ) : null}
          {props.serverId ? (
            <OutlinedButton
              onClick={() => setConfirmDelete(true)}
              enabled={!editor.pending}
              modifiers={[fillMaxWidth()]}
            >
              <ComposeText color={colors.error}>{t('action.delete', { ns: 'common' })}</ComposeText>
            </OutlinedButton>
          ) : null}
          <TextButton onClick={props.onClose} modifiers={[fillMaxWidth()]}>
            <ComposeText>{t('action.cancel', { ns: 'common' })}</ComposeText>
          </TextButton>
        </Column>
      </ModalBottomSheet>
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
    </>
  );
}
