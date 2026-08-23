import React from 'react';

import { useSettingsStore } from '@/features/settings';
import { LanMySpaceContent } from './LanMySpaceContent';
import type { MySpaceSheetProps } from './MySpaceSheet.types';
import { P2pMySpaceContent } from './P2pMySpaceContent';

export function MySpaceSheet(props: MySpaceSheetProps) {
  const syncChannel = useSettingsStore((state) => state.config?.syncChannel ?? 'lan');
  return syncChannel === 'lan' ? (
    <LanMySpaceContent key={syncChannel} {...props} />
  ) : (
    <P2pMySpaceContent key={syncChannel} {...props} />
  );
}
