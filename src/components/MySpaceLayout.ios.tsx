import React, { useEffect, useState } from 'react';
import {
  BottomSheet,
  Button as SwiftUIButton,
  Group,
  Host,
  Image,
  List,
  ProgressView,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled,
  font,
  glassEffect,
  listStyle,
  padding,
  presentationDetents,
  presentationDragIndicator,
  refreshable,
  scrollContentBackground,
  type PresentationDetent,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import { IosSheetPage } from '@/components/ui';
import { iosAccentColor } from '@/theme/iosDesignTokens';
import type { MySpaceLayoutProps } from './MySpaceLayout.types';

interface IosMySpaceLayoutProps extends MySpaceLayoutProps {
  page?: React.ReactNode;
}

export function MySpaceLayout({
  visible,
  onClose,
  title,
  actionLabel,
  onAction,
  actionPending,
  actionEnabled,
  onRefresh,
  prefersLarge = false,
  children,
  supplementary,
  page,
}: IosMySpaceLayoutProps) {
  const [sheetDetent, setSheetDetent] = useState<PresentationDetent>('medium');

  useEffect(() => {
    if (!visible) setSheetDetent('medium');
  }, [visible]);

  useEffect(() => {
    if (prefersLarge) setSheetDetent('large');
  }, [prefersLarge]);

  return (
    <Host style={styles.host}>
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
      >
        <Group
          modifiers={[
            presentationDetents(['medium', 'large'], {
              selection: prefersLarge ? 'large' : sheetDetent,
              onSelectionChange: setSheetDetent,
            }),
            presentationDragIndicator('visible'),
          ]}
        >
          {page ?? (
            <IosSheetPage
              title={title}
              rightSlots={[
                <SwiftUIButton
                  key="add"
                  onPress={onAction}
                  modifiers={[
                    buttonStyle('plain'),
                    disabled(!actionEnabled || actionPending),
                    accessibilityLabel(actionLabel),
                    glassEffect({
                      glass: { variant: 'regular', interactive: true },
                      shape: 'circle',
                    }),
                  ]}
                >
                  {actionPending ? (
                    <ProgressView modifiers={[padding()]} />
                  ) : (
                    <Image
                      systemName="plus"
                      size={18}
                      color={iosAccentColor}
                      modifiers={[font({ weight: 'semibold' }), padding()]}
                    />
                  )}
                </SwiftUIButton>,
              ]}
            >
              <List
                modifiers={[
                  listStyle('insetGrouped'),
                  scrollContentBackground('hidden'),
                  refreshable(async () => {
                    await onRefresh();
                  }),
                ]}
              >
                {children}
              </List>
            </IosSheetPage>
          )}
        </Group>
      </BottomSheet>
      {supplementary}
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', bottom: 0, left: 0, width: 1, height: 1 },
});
