import type React from 'react';

export interface MySpaceLayoutProps {
  visible: boolean;
  onClose(): void;
  title: string;
  actionLabel: string;
  onAction(): void;
  actionPending: boolean;
  actionEnabled: boolean;
  isRefreshing: boolean;
  onRefresh(): Promise<void> | void;
  prefersLarge?: boolean;
  contentHeight?: number;
  children: React.ReactNode;
  supplementary?: React.ReactNode;
}
