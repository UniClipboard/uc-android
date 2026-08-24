import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import {
  BottomSheet,
  Button,
  Group,
  HStack,
  Image,
  ProgressView,
  Section,
  SecureField,
  Spacer,
  Text as SwiftUIText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  disabled,
  frame,
  keyboardType,
  presentationDetents,
  presentationDragIndicator,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useTranslation } from 'react-i18next';

import { IosSheetForm, IosSheetPage } from '@/components/ui';
import {
  HeaderCircleButton,
  SettingsNavRow,
  SettingsToggle,
} from '@/screens/settings/ios/common';
import { useLanServerEditor } from '@/features/lan-servers/useLanServerEditor';
import { parseLanConnectUri } from '@/features/lan-servers';
import { scanQRCode } from 'qr-scanner';
import type { LanServerEditorSheetProps } from './LanServerEditorSheet.types';

function NativeTextField({
  value,
  onChange,
  placeholder,
  secure = false,
  url = false,
}: {
  value: string;
  onChange(value: string): void;
  placeholder: string;
  secure?: boolean;
  url?: boolean;
}) {
  const text = useNativeState(value);
  const latestNativeValue = useRef(value);
  useEffect(() => {
    if (value === latestNativeValue.current) return;
    latestNativeValue.current = value;
    text.set(value);
  }, [text, value]);
  const handleTextChange = useCallback(
    (nextValue: string) => {
      latestNativeValue.current = nextValue;
      onChange(nextValue);
    },
    [onChange]
  );

  return secure ? (
    <SecureField text={text} placeholder={placeholder} onTextChange={handleTextChange} />
  ) : (
    <TextField
      text={text}
      placeholder={placeholder}
      onTextChange={handleTextChange}
      modifiers={[
        autocorrectionDisabled(),
        textInputAutocapitalization('never'),
        ...(url ? [keyboardType('url')] : []),
      ]}
    />
  );
}

export function LanServerEditorSheet(props: LanServerEditorSheetProps) {
  const { t } = useTranslation('settingsSync');
  const editor = useLanServerEditor({
    visible: props.visible,
    serverId: props.serverId,
    initialIntent: props.initialIntent,
    onFinished: props.onClose,
  });
  const handleScan = useCallback(async () => {
    try {
      const raw = await scanQRCode(
        t('action.cancel', { ns: 'common' }),
        t('lan.qr.hint')
      );
      if (!raw) return;
      const parsed = parseLanConnectUri(raw);
      if (!parsed.ok) {
        Alert.alert(t('lan.qr.failedTitle'), t(`lan.qr.errors.${parsed.error}`));
        return;
      }
      editor.applyIntent(parsed.value);
    } catch {
      Alert.alert(t('lan.qr.failedTitle'), t('lan.qr.errors.PAYLOAD_DECODE_FAILED'));
    }
  }, [editor.applyIntent, t]);
  const page = (
    <IosSheetPage
            title={props.serverId ? t('lan.edit') : t('lan.add')}
            leftSlots={[
              <HeaderCircleButton
                key="navigation"
                systemName={props.embedded ? 'chevron.left' : 'xmark'}
                accessibilityLabel={t(props.embedded ? 'action.back' : 'action.cancel', {
                  ns: 'common',
                })}
                onPress={props.onClose}
              />,
            ]}
            rightSlots={[
              <HeaderCircleButton
                key="save"
                systemName="checkmark"
                accessibilityLabel={t('action.save', { ns: 'common' })}
                disabled={editor.pending || !editor.canSave}
                onPress={() => void editor.save()}
              />,
            ]}
          >
            <IosSheetForm>
              <Section footer={<SwiftUIText>{t('lan.scanHint')}</SwiftUIText>}>
                <SettingsNavRow
                  icon="qrcode.viewfinder"
                  title={t('lan.scan')}
                  showsChevron={false}
                  onPress={() => void handleScan()}
                />
              </Section>

              <Section header={<SwiftUIText>{t('lan.name')}</SwiftUIText>}>
                <NativeTextField
                  value={editor.name}
                  onChange={editor.setName}
                  placeholder={t('lan.namePlaceholder')}
                />
              </Section>

              <Section
                header={<SwiftUIText>{t('lan.addresses')}</SwiftUIText>}
                footer={<SwiftUIText>{t('lan.addressesHint')}</SwiftUIText>}
              >
                {editor.urls.map((url, index) => (
                  <HStack key={`lan-url-${index}`} spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
                    <NativeTextField
                      value={url}
                      onChange={(value) => editor.updateUrl(index, value)}
                      placeholder="http://192.168.1.5:42720"
                      url
                    />
                    {editor.urls.length > 1 ? (
                      <Button onPress={() => editor.removeUrl(index)}>
                        <Image systemName="minus.circle.fill" color="#FF3B30" />
                      </Button>
                    ) : null}
                  </HStack>
                ))}
                <SettingsNavRow
                  icon="plus.circle"
                  title={t('lan.addAddress')}
                  showsChevron={false}
                  onPress={editor.addUrl}
                />
              </Section>

              <Section header={<SwiftUIText>{t('lan.credentials')}</SwiftUIText>}>
                <NativeTextField
                  value={editor.username}
                  onChange={editor.setUsername}
                  placeholder={t('lan.username')}
                />
                <NativeTextField
                  value={editor.password}
                  onChange={editor.setPassword}
                  placeholder={t('lan.password')}
                  secure
                />
              </Section>

              <Section footer={<SwiftUIText>{t('lan.insecureTlsHint')}</SwiftUIText>}>
                <SettingsToggle
                  label={t('lan.allowInsecureTls')}
                  isOn={editor.allowInsecureTls}
                  onIsOnChange={editor.setAllowInsecureTls}
                />
              </Section>

              <Section
                header={<SwiftUIText>{t('lan.probe.section')}</SwiftUIText>}
                footer={
                  editor.probeResults ? (
                    <SwiftUIText>
                      {Object.values(editor.probeResults).some((result) => result === 'Success')
                        ? t('lan.probe.success')
                        : Object.values(editor.probeResults).some(
                              (result) => result === 'AuthFailed'
                            )
                          ? t('lan.probe.authFailed')
                          : t('lan.probe.allUnreachable')}
                    </SwiftUIText>
                  ) : undefined
                }
              >
                {editor.probeResults
                  ? editor.urls.map((url, index) => {
                      const candidate = url.trim();
                      const result = editor.probeResults?.[candidate];
                      if (!candidate || !result) return null;
                      const isPreferred = candidate === editor.preferredProbeUrl;
                      return (
                        <HStack key={`lan-probe-${index}`} spacing={8}>
                          <SwiftUIText>{candidate}</SwiftUIText>
                          <Spacer />
                          {isPreferred ? (
                            <SwiftUIText>{t('lan.probe.willUse')}</SwiftUIText>
                          ) : null}
                          <Image
                            systemName={
                              result === 'Success'
                                ? 'checkmark.circle.fill'
                                : result === 'AuthFailed'
                                  ? 'lock.trianglebadge.exclamationmark.fill'
                                  : result === 'MissingFields'
                                    ? 'circle.dotted'
                                    : 'xmark.circle'
                            }
                          />
                        </HStack>
                      );
                    })
                  : null}
                {editor.isProbing ? (
                  <HStack spacing={8}>
                    <ProgressView />
                    <SwiftUIText>{t('lan.probe.testing')}</SwiftUIText>
                  </HStack>
                ) : (
                  <Button
                    label={
                      editor.probeResults ? t('lan.probe.retest') : t('lan.probe.test')
                    }
                    onPress={() => void editor.probe()}
                    modifiers={[disabled(!editor.urls.some((url) => url.trim()))]}
                  />
                )}
              </Section>

              {editor.error ? <Section><SwiftUIText>{editor.error}</SwiftUIText></Section> : null}

              <Section>
                {props.serverId ? (
                  <SettingsNavRow
                    title={t('action.delete', { ns: 'common' })}
                    destructive
                    showsChevron={false}
                    disabled={editor.pending}
                    onPress={() => void editor.remove()}
                  />
                ) : null}
              </Section>
            </IosSheetForm>
    </IosSheetPage>
  );
  if (props.embedded) return page;
  return (
    <Group>
      <BottomSheet
        isPresented={props.visible}
        onIsPresentedChange={(presented) => {
          if (!presented) props.onClose();
        }}
      >
        <Group modifiers={[presentationDetents(['large']), presentationDragIndicator('visible')]}>
          {page}
        </Group>
      </BottomSheet>
    </Group>
  );
}
