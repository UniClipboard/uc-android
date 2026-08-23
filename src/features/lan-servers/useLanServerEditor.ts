import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from '@/features/settings';
import { getLanServerService } from './internal/lanServerService';
import { useLanQrScannerStore } from './handoff';
import { probeLanServers, type LanServerProbeResult } from './probeLanServers';
import type { LanConnectIntent } from './connectUri';

export interface UseLanServerEditorOptions {
  visible: boolean;
  serverId: string | null;
  initialIntent?: LanConnectIntent | null;
  selectAfterSave?: boolean;
  onFinished(): void;
}

export function useLanServerEditor({
  visible,
  serverId,
  initialIntent,
  selectAfterSave = false,
  onFinished,
}: UseLanServerEditorOptions) {
  const activeServerId = useSettingsStore((state) => state.config?.activeLanServerId ?? null);
  const loadConfig = useSettingsStore((state) => state.loadConfig);
  const [name, setName] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [allowInsecureTls, setAllowInsecureTls] = useState(false);
  const [pending, setPending] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [probeResults, setProbeResults] = useState<Record<string, LanServerProbeResult> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const applyIntent = useCallback((intent: LanConnectIntent) => {
    setUrls(intent.urls.length > 0 ? intent.urls : ['']);
    setUsername(intent.username);
    setPassword(intent.password);
    if (intent.name) setName(intent.name);
    setProbeResults(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setPending(Boolean(serverId));
    setIsProbing(false);
    setProbeResults(null);
    setError(null);
    void (async () => {
      try {
        if (serverId) {
          const draft = await getLanServerService().getDraft(serverId);
          if (cancelled) return;
          setName(draft.name);
          setUrls(draft.urls.length > 0 ? draft.urls : ['']);
          setUsername(draft.username);
          setPassword(draft.password);
          setAllowInsecureTls(draft.allowInsecureTls);
        } else {
          setName('');
          setUrls(['']);
          setUsername('');
          setPassword('');
          setAllowInsecureTls(false);
        }
        if (initialIntent && !cancelled) applyIntent(initialIntent);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyIntent, initialIntent, serverId, visible]);

  const updateUrl = useCallback((index: number, value: string) => {
    setProbeResults(null);
    setUrls((current) =>
      current.map((url, currentIndex) => (currentIndex === index ? value : url))
    );
  }, []);
  const addUrl = useCallback(() => {
    setProbeResults(null);
    setUrls((current) => [...current, '']);
  }, []);
  const removeUrl = useCallback((index: number) => {
    setProbeResults(null);
    setUrls((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0 ? next : [''];
    });
  }, []);
  const changeName = useCallback((value: string) => {
    setProbeResults(null);
    setName(value);
  }, []);
  const changeUsername = useCallback((value: string) => {
    setProbeResults(null);
    setUsername(value);
  }, []);
  const changePassword = useCallback((value: string) => {
    setProbeResults(null);
    setPassword(value);
  }, []);
  const changeAllowInsecureTls = useCallback((value: boolean) => {
    setProbeResults(null);
    setAllowInsecureTls(value);
  }, []);
  const openScanner = useCallback(() => {
    useLanQrScannerStore.getState().open(applyIntent);
  }, [applyIntent]);

  const save = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const saved = await getLanServerService().save(
        { name, urls, username, password, allowInsecureTls },
        serverId ?? undefined
      );
      if (!serverId && selectAfterSave) {
        await getLanServerService().select(saved.id);
      }
      await loadConfig();
      onFinished();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }, [
    allowInsecureTls,
    loadConfig,
    name,
    onFinished,
    password,
    selectAfterSave,
    serverId,
    urls,
    username,
  ]);

  const remove = useCallback(async () => {
    if (!serverId) return;
    setPending(true);
    setError(null);
    try {
      await getLanServerService().remove(serverId);
      await loadConfig();
      onFinished();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }, [loadConfig, onFinished, serverId]);

  const select = useCallback(async () => {
    if (!serverId) return;
    setPending(true);
    setError(null);
    try {
      await getLanServerService().select(serverId);
      await loadConfig();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }, [loadConfig, serverId]);

  const probe = useCallback(async () => {
    setIsProbing(true);
    setProbeResults(null);
    try {
      setProbeResults(await probeLanServers({ urls, username, password, allowInsecureTls }));
    } finally {
      setIsProbing(false);
    }
  }, [allowInsecureTls, password, urls, username]);

  const canSave = useMemo(
    () => urls.some((url) => url.trim()) && Boolean(username.trim()) && password.length > 0,
    [password.length, urls, username]
  );
  const preferredProbeUrl = useMemo(() => {
    if (!probeResults) return null;
    return (
      urls
        .map((url) => url.trim())
        .find((url) => probeResults[url] === 'Success' || probeResults[url] === 'AuthFailed') ??
      null
    );
  }, [probeResults, urls]);

  return {
    name,
    setName: changeName,
    urls,
    updateUrl,
    addUrl,
    removeUrl,
    username,
    setUsername: changeUsername,
    password,
    setPassword: changePassword,
    allowInsecureTls,
    setAllowInsecureTls: changeAllowInsecureTls,
    pending,
    isProbing,
    probeResults,
    preferredProbeUrl,
    error,
    canSave,
    isActive: serverId !== null && serverId === activeServerId,
    applyIntent,
    openScanner,
    probe,
    save,
    remove,
    select,
  };
}
