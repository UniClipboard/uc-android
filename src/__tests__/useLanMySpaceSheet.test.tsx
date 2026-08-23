import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useLanMySpaceSheet } from '@/components/useLanMySpaceSheet';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetDraft = jest.fn();
const mockProbeLanServers = jest.fn();
let mockSettingsConfig:
  | { lanServers: typeof profiles; activeLanServerId: string | null }
  | undefined;

const profiles = [
  {
    id: 'home',
    name: 'Home Mac',
    urls: ['http://home.local:42720'],
    username: 'mobile',
    allowInsecureTls: false,
  },
  {
    id: 'office',
    name: 'Office Mac',
    urls: ['https://office.local:42720'],
    username: 'phone',
    allowInsecureTls: true,
  },
];

jest.mock('@/features/settings', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      config: mockSettingsConfig,
    }),
}));

jest.mock('@/features/lan-servers', () => ({
  getLanServerService: () => ({ getDraft: mockGetDraft }),
  probeLanServers: (input: unknown) => mockProbeLanServers(input),
}));

type LanSheetState = ReturnType<typeof useLanMySpaceSheet>;
let current!: LanSheetState;
let renderer: ReactTestRenderer | null = null;

function Harness({ visible }: { visible: boolean }) {
  current = useLanMySpaceSheet(visible);
  return null;
}

describe('useLanMySpaceSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsConfig = { lanServers: profiles, activeLanServerId: 'home' };
    mockGetDraft.mockImplementation(async (serverId: string) => {
      const profile = profiles.find((server) => server.id === serverId)!;
      return { ...profile, password: `${serverId}-secret` };
    });
    mockProbeLanServers.mockImplementation(async ({ username }: { username: string }) =>
      username === 'mobile'
        ? { 'http://home.local:42720': 'Success' }
        : { 'https://office.local:42720': 'AuthFailed' }
    );
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = null;
  });

  it('does no server work while its channel content is hidden', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<Harness visible={false} />);
      await Promise.resolve();
    });

    expect(mockGetDraft).not.toHaveBeenCalled();
    expect(mockProbeLanServers).not.toHaveBeenCalled();
  });

  it('stays unconfigured without repeated work while settings are not loaded', async () => {
    mockSettingsConfig = undefined;
    await act(async () => {
      renderer = TestRenderer.create(<Harness visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current.isUnconfigured).toBe(true);
    expect(current.servers).toEqual([]);
    expect(mockGetDraft).not.toHaveBeenCalled();
    expect(mockProbeLanServers).not.toHaveBeenCalled();
  });

  it('checks every configured server and preserves the active selection', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<Harness visible />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGetDraft).toHaveBeenCalledTimes(2);
    expect(mockProbeLanServers).toHaveBeenCalledTimes(2);
    expect(current.servers).toEqual([
      expect.objectContaining({ id: 'home', isActive: true, status: 'online' }),
      expect.objectContaining({ id: 'office', isActive: false, status: 'authFailed' }),
    ]);
    expect(current.isUnconfigured).toBe(false);
    expect(current.isRefreshing).toBe(false);
  });

  it('rechecks servers on an explicit refresh', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<Harness visible />);
      await Promise.resolve();
      await Promise.resolve();
    });
    jest.clearAllMocks();

    await act(async () => current.refresh());

    expect(mockGetDraft).toHaveBeenCalledTimes(2);
    expect(mockProbeLanServers).toHaveBeenCalledTimes(2);
  });
});
