import { useState } from 'react';
import {
  AlertDialog,
  Button,
  CircularProgressIndicator,
  Column,
  HorizontalDivider,
  Icon,
  IconButton,
  ListItem,
  ModalBottomSheet,
  OutlinedButton,
  Row,
  Shape,
  Spacer,
  Surface,
  Switch as ComposeSwitch,
  Text as ComposeText,
  TextButton,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  fillMaxWidth,
  height,
  imePadding,
  padding,
  toggleable,
  verticalScroll,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTranslation } from 'react-i18next';

import { AppTextField } from '@/components/ui';
import { useLanServerEditor } from '@/features/lan-servers/useLanServerEditor';
import type { LanServerEditorSheetProps } from './LanServerEditorSheet.types';

const ICONS = {
  add: require('../assets/icons/add.xml'),
  check: require('../assets/icons/check_circle.xml'),
  close: require('../assets/icons/close.xml'),
  delete: require('../assets/icons/delete.xml'),
  qr: require('../assets/icons/qr_code_scanner.xml'),
  unavailable: require('../assets/icons/close.xml'),
  wifi: require('../assets/icons/wifi.xml'),
};
const TITLE_STYLE = { fontSize: 20, fontWeight: '600', letterSpacing: 0 } as const;
const SECTION_STYLE = { fontSize: 14, fontWeight: '600', letterSpacing: 0 } as const;
const EDITOR_GROUP_SHAPE = Shape.RoundedCorner({
  cornerRadii: { topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 16 },
});

export function LanServerEditorSheet(props: LanServerEditorSheetProps) {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const editor = useLanServerEditor({
    visible: props.visible,
    serverId: props.serverId,
    initialIntent: props.initialIntent,
    selectAfterSave: props.selectAfterSave,
    onFinished: props.onClose,
  });
  const requestClose = () => {
    if (editor.isDirty) {
      setConfirmDiscard(true);
      return;
    }
    props.onClose();
  };

  if (!props.visible) return null;

  return (
    <>
      <ModalBottomSheet skipPartiallyExpanded onDismissRequest={requestClose}>
        <Column modifiers={[fillMaxSize(), imePadding()]}>
          <EditorHeader serverId={props.serverId} onClose={requestClose} />
          <HorizontalDivider color={colors.outlineVariant} />
          <EditorForm editor={editor} serverId={props.serverId} />
          <EditorFooter
            editor={editor}
            serverId={props.serverId}
            onDelete={() => setConfirmDelete(true)}
          />
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
      {confirmDiscard ? (
        <AlertDialog onDismissRequest={() => setConfirmDiscard(false)}>
          <AlertDialog.Title>
            <ComposeText>{t('lan.discardTitle')}</ComposeText>
          </AlertDialog.Title>
          <AlertDialog.Text>
            <ComposeText>{t('lan.discardMessage')}</ComposeText>
          </AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <TextButton
              onClick={() => {
                setConfirmDiscard(false);
                props.onClose();
              }}
            >
              <ComposeText color={colors.error}>{t('lan.discardAction')}</ComposeText>
            </TextButton>
          </AlertDialog.ConfirmButton>
          <AlertDialog.DismissButton>
            <TextButton onClick={() => setConfirmDiscard(false)}>
              <ComposeText>{t('action.cancel', { ns: 'common' })}</ComposeText>
            </TextButton>
          </AlertDialog.DismissButton>
        </AlertDialog>
      ) : null}
    </>
  );
}

type EditorState = ReturnType<typeof useLanServerEditor>;

function EditorHeader({ serverId, onClose }: { serverId: string | null; onClose: () => void }) {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  return (
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(12, 4, 16, 4)]}>
      <IconButton onClick={onClose}>
        <Icon
          source={ICONS.close}
          size={22}
          tint={colors.onSurface}
          contentDescription={t('action.close', { ns: 'common' })}
        />
      </IconButton>
      <Spacer modifiers={[width(8)]} />
      <ComposeText style={TITLE_STYLE} color={colors.onSurface}>
        {serverId ? t('lan.edit') : t('lan.add')}
      </ComposeText>
    </Row>
  );
}

function EditorForm({ editor, serverId }: { editor: EditorState; serverId: string | null }) {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  return (
    <Column modifiers={[weight(1), verticalScroll()]}>
      <Column modifiers={[fillMaxWidth(), padding(24, 20, 24, 24)]}>
        <ComposeText style={SECTION_STYLE} color={colors.primary}>
          {t('lan.connectionInfo')}
        </ComposeText>
        <Spacer modifiers={[height(6)]} />
        <ComposeText color={colors.onSurfaceVariant}>{t('lan.scanHint')}</ComposeText>
        <Spacer modifiers={[height(10)]} />
        <OutlinedButton onClick={editor.openScanner} modifiers={[fillMaxWidth()]}>
          <Icon source={ICONS.qr} size={18} tint={colors.primary} />
          <Spacer modifiers={[width(8)]} />
          <ComposeText>{t('lan.scan')}</ComposeText>
        </OutlinedButton>
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
        <Spacer modifiers={[height(24)]} />
        <ComposeText style={SECTION_STYLE} color={colors.primary}>
          {t('lan.credentials')}
        </ComposeText>
        <Spacer modifiers={[height(10)]} />
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
          secureToggleLabel={t('lan.passwordShow')}
          secureHideLabel={t('lan.passwordHide')}
          fullWidth
        />
        <Spacer modifiers={[height(24)]} />
        <ComposeText style={SECTION_STYLE} color={colors.primary}>
          {t('lan.security')}
        </ComposeText>
        <Spacer modifiers={[height(6)]} />
        <SecurityControl editor={editor} />
        <Spacer modifiers={[height(16)]} />
        <OutlinedButton
          onClick={() => void editor.probe()}
          enabled={!editor.isProbing && editor.urls.some((url) => url.trim())}
          modifiers={[fillMaxWidth()]}
        >
          {editor.isProbing ? (
            <CircularProgressIndicator modifiers={[width(18), height(18)]} />
          ) : (
            <Icon source={ICONS.wifi} size={18} tint={colors.primary} />
          )}
          <Spacer modifiers={[width(8)]} />
          <ComposeText>
            {editor.isProbing
              ? t('lan.probe.testing')
              : editor.probeResults
              ? t('lan.probe.retest')
              : t('lan.probe.test')}
          </ComposeText>
        </OutlinedButton>
        <ProbeResults editor={editor} />
        {serverId && !editor.isActive ? (
          <>
            <Spacer modifiers={[height(20)]} />
            <OutlinedButton
              onClick={() => void editor.select()}
              enabled={!editor.pending}
              modifiers={[fillMaxWidth()]}
            >
              <ComposeText>{t('lan.makeActive')}</ComposeText>
            </OutlinedButton>
          </>
        ) : null}
      </Column>
    </Column>
  );
}

function SecurityControl({ editor }: { editor: EditorState }) {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  return (
    <Surface
      color={colors.surfaceContainerLow}
      border={{ color: colors.outlineVariant }}
      shape={EDITOR_GROUP_SHAPE}
      modifiers={[fillMaxWidth()]}
    >
      <Row
        verticalAlignment="center"
        modifiers={[
          fillMaxWidth(),
          toggleable(
            editor.allowInsecureTls,
            () => editor.setAllowInsecureTls(!editor.allowInsecureTls),
            { role: 'switch' }
          ),
          padding(16, 12, 16, 12),
        ]}
      >
        <Column modifiers={[weight(1)]}>
          <ComposeText color={colors.onSurface}>{t('lan.allowInsecureTls')}</ComposeText>
          <Spacer modifiers={[height(4)]} />
          <ComposeText color={colors.onSurfaceVariant}>{t('lan.insecureTlsHint')}</ComposeText>
        </Column>
        <Spacer modifiers={[width(12)]} />
        <ComposeSwitch value={editor.allowInsecureTls} onCheckedChange={undefined} />
      </Row>
    </Surface>
  );
}

function ProbeResults({ editor }: { editor: EditorState }) {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  if (!editor.probeResults) return null;
  return (
    <>
      <Spacer modifiers={[height(12)]} />
      <Surface
        color={colors.surfaceContainerLow}
        border={{ color: colors.outlineVariant }}
        shape={EDITOR_GROUP_SHAPE}
        modifiers={[fillMaxWidth()]}
      >
        <Column>
          {editor.urls.map((url, index) => {
            const candidate = url.trim();
            const result = editor.probeResults?.[candidate];
            if (!candidate || !result) return null;
            return (
              <Column key={`lan-probe-${index}`}>
                <ListItem>
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
                      {candidate === editor.preferredProbeUrl ? ` · ${t('lan.probe.willUse')}` : ''}
                    </ComposeText>
                  </ListItem.SupportingContent>
                </ListItem>
                {index < editor.urls.length - 1 ? (
                  <HorizontalDivider color={colors.outlineVariant} modifiers={[fillMaxWidth()]} />
                ) : null}
              </Column>
            );
          })}
        </Column>
      </Surface>
    </>
  );
}

function EditorFooter({
  editor,
  serverId,
  onDelete,
}: {
  editor: EditorState;
  serverId: string | null;
  onDelete: () => void;
}) {
  const { t } = useTranslation('settingsSync');
  const colors = useMaterialColors();
  return (
    <Column modifiers={[fillMaxWidth()]}>
      <HorizontalDivider color={colors.outlineVariant} />
      {editor.error ? (
        <Column modifiers={[padding(16, 8, 16, 0)]}>
          <ComposeText color={colors.error}>{editor.error}</ComposeText>
        </Column>
      ) : null}
      <Row modifiers={[fillMaxWidth(), padding(16, 12, 16, 16)]}>
        {serverId ? (
          <>
            <OutlinedButton onClick={onDelete} enabled={!editor.pending} modifiers={[weight(1)]}>
              <Icon source={ICONS.delete} size={18} tint={colors.error} />
              <Spacer modifiers={[width(8)]} />
              <ComposeText color={colors.error}>{t('action.delete', { ns: 'common' })}</ComposeText>
            </OutlinedButton>
            <Spacer modifiers={[width(12)]} />
          </>
        ) : null}
        <Button
          onClick={() => void editor.save()}
          enabled={!editor.pending && editor.canSave}
          modifiers={[weight(1)]}
        >
          <ComposeText>{t('action.save', { ns: 'common' })}</ComposeText>
        </Button>
      </Row>
    </Column>
  );
}
