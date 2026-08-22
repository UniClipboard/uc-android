import { navigateWhenReady } from '@/navigation/navigationRef';

export function openLanServerSettings(): void {
  navigateWhenReady('SettingsSub', { section: 'lanServers' });
}
