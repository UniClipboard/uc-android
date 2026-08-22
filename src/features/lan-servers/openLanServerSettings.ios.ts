import { navigateWhenReady } from '@/navigation/navigationRef';

export function openLanServerSettings(): void {
  navigateWhenReady('Settings', { section: 'lanServers' });
}
