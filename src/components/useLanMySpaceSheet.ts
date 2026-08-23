import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getLanServerService, probeLanServers } from '@/features/lan-servers';
import type { LanServerProfile } from '@/features/lan-servers';
import { useSettingsStore } from '@/features/settings';

const EMPTY_LAN_SERVERS: LanServerProfile[] = [];

export type LanMySpaceServerStatus = 'unknown' | 'checking' | 'online' | 'authFailed' | 'offline';

export interface LanMySpaceServerView {
  id: string;
  name: string;
  address: string;
  addressCount: number;
  isActive: boolean;
  status: LanMySpaceServerStatus;
}

function serverStatus(results: Record<string, string>): LanMySpaceServerStatus {
  const values = Object.values(results);
  if (values.includes('Success')) return 'online';
  if (values.includes('AuthFailed')) return 'authFailed';
  return 'offline';
}

export function useLanMySpaceSheet(visible: boolean) {
  const configuredProfiles = useSettingsStore((state) => state.config?.lanServers);
  const profiles = configuredProfiles ?? EMPTY_LAN_SERVERS;
  const activeServerId = useSettingsStore((state) => state.config?.activeLanServerId ?? null);
  const [statusById, setStatusById] = useState<Record<string, LanMySpaceServerStatus>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    if (!visible) return;
    const generation = ++refreshGeneration.current;
    setIsRefreshing(true);
    setStatusById((current) =>
      Object.fromEntries(profiles.map((profile) => [profile.id, current[profile.id] ?? 'checking']))
    );
    const statuses = await Promise.all(
      profiles.map(async (profile) => {
        try {
          const draft = await getLanServerService().getDraft(profile.id);
          const results = await probeLanServers(draft);
          return [profile.id, serverStatus(results)] as const;
        } catch {
          return [profile.id, 'offline'] as const;
        }
      })
    );
    if (generation !== refreshGeneration.current) return;
    setStatusById(Object.fromEntries(statuses));
    setIsRefreshing(false);
  }, [profiles, visible]);

  useEffect(() => {
    if (!visible) {
      refreshGeneration.current += 1;
      setStatusById({});
      setIsRefreshing(false);
      return;
    }
    void refresh();
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh, visible]);

  const servers = useMemo<LanMySpaceServerView[]>(
    () =>
      profiles.map((profile) => ({
        id: profile.id,
        name: profile.name || profile.urls[0],
        address: profile.urls[0],
        addressCount: profile.urls.length,
        isActive: profile.id === activeServerId,
        status: statusById[profile.id] ?? (visible ? 'checking' : 'unknown'),
      })),
    [activeServerId, profiles, statusById, visible]
  );

  return {
    servers,
    isUnconfigured: profiles.length === 0,
    isRefreshing,
    refresh,
  };
}
