import React from 'react';
import {
  CircularProgressIndicator,
  Column,
  Host,
  Icon,
  IconButton,
  LazyColumn,
  Row,
  Spacer,
  Text as ComposeText,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  animateContentSize,
  fillMaxWidth,
  height,
  padding,
  weight,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AppBottomSheet } from './ui';
import type { MySpaceLayoutProps } from './MySpaceLayout.types';

const ADD_ICON = require('../assets/icons/add.xml');
const TITLE_STYLE = { fontSize: 20, fontWeight: '600' } as const;
type AndroidMySpaceLayoutProps = Omit<MySpaceLayoutProps, 'isRefreshing' | 'onRefresh'>;

export function MySpaceLayout({
  visible,
  onClose,
  title,
  actionLabel,
  onAction,
  actionPending,
  actionEnabled,
  contentHeight = 320,
  children,
  supplementary,
}: AndroidMySpaceLayoutProps) {
  const { theme } = useTheme();
  const safeContentHeight = Math.min(Math.max(contentHeight, 112), 520);

  return (
    <AppBottomSheet visible={visible} onDismiss={onClose}>
      <Host
        colorScheme={theme.isDark ? 'dark' : 'light'}
        seedColor={theme.colors.accent}
        matchContents={{ vertical: true }}
        style={styles.host}
      >
        <MySpaceLayoutContent
          title={title}
          actionLabel={actionLabel}
          onAction={onAction}
          actionPending={actionPending}
          actionEnabled={actionEnabled}
          contentHeight={safeContentHeight}
        >
          {children}
        </MySpaceLayoutContent>
        {supplementary}
      </Host>
    </AppBottomSheet>
  );
}

function MySpaceLayoutContent({
  title,
  actionLabel,
  onAction,
  actionPending,
  actionEnabled,
  contentHeight,
  children,
}: Omit<
  AndroidMySpaceLayoutProps,
  'visible' | 'onClose' | 'prefersLarge' | 'supplementary' | 'contentHeight'
> & { contentHeight: number }) {
  const colors = useMaterialColors();
  return (
    <Column modifiers={[fillMaxWidth(), animateContentSize()]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(24, 0, 12, 8)]}>
        <ComposeText style={TITLE_STYLE} color={colors.onSurface}>
          {title}
        </ComposeText>
        <Spacer modifiers={[weight(1)]} />
        <IconButton onClick={onAction} enabled={actionEnabled && !actionPending}>
          {actionPending ? (
            <CircularProgressIndicator modifiers={[width(24), height(24)]} />
          ) : (
            <Icon
              source={ADD_ICON}
              size={24}
              tint={colors.primary}
              contentDescription={actionLabel}
            />
          )}
        </IconButton>
      </Row>
      <LazyColumn
        contentPadding={{ start: 12, end: 12, bottom: 20 }}
        modifiers={[fillMaxWidth(), height(contentHeight)]}
      >
        {children}
      </LazyColumn>
    </Column>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%' },
});
