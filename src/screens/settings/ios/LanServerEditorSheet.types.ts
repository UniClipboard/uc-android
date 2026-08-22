import type { LanConnectIntent } from '@/features/lan-servers';

export interface LanServerEditorSheetProps {
  visible: boolean;
  serverId: string | null;
  initialIntent?: LanConnectIntent | null;
  onClose(): void;
}
