import { useCallback, useEffect, useRef } from 'react';
import {
  BottomSheet,
  Button,
  Group,
  HStack,
  Image,
  Section,
  SecureField,
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
import { SettingsNavRow, SettingsToggle } from '@/screens/settings/ios/common';
import { useLanServerEditor } from '@/features/lan-servers/useLanServerEditor';
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

  return (
    <Group>
      <BottomSheet
        isPresented={props.visible}
        onIsPresentedChange={(presented) => {
          if (!presented) props.onClose();
        }}
      >
        <Group modifiers={[presentationDetents(['large']), presentationDragIndicator('visible')]}>
          <IosSheetPage title={props.serverId ? t('lan.edit') : t('lan.add')}>
            <IosSheetForm>
              <Section footer={<SwiftUIText>{t('lan.scanHint')}</SwiftUIText>}>
                <SettingsNavRow
                  icon="qrcode.viewfinder"
                  title={t('lan.scan')}
                  showsChevron={false}
                  onPress={editor.openScanner}
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

              {editor.error ? <Section><SwiftUIText>{editor.error}</SwiftUIText></Section> : null}

              <Section>
                <Button
                  label={t('action.save', { ns: 'common' })}
                  onPress={() => void editor.save()}
                  modifiers={[disabled(editor.pending || !editor.canSave)]}
                />
                {props.serverId && !editor.isActive ? (
                  <Button
                    label={t('lan.makeActive')}
                    onPress={() => void editor.select()}
                    modifiers={[disabled(editor.pending)]}
                  />
                ) : null}
                {props.serverId ? (
                  <SettingsNavRow
                    title={t('action.delete', { ns: 'common' })}
                    destructive
                    showsChevron={false}
                    disabled={editor.pending}
                    onPress={() => void editor.remove()}
                  />
                ) : null}
                <Button label={t('action.cancel', { ns: 'common' })} onPress={props.onClose} />
              </Section>
            </IosSheetForm>
          </IosSheetPage>
        </Group>
      </BottomSheet>
    </Group>
  );
}
