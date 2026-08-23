import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { useLanServerEditor } from '@/features/lan-servers/useLanServerEditor';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockSave = jest.fn();
const mockSelect = jest.fn();
const mockLoadConfig = jest.fn();
const mockFinished = jest.fn();

jest.mock('@/features/settings', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      config: { activeLanServerId: 'existing' },
      loadConfig: mockLoadConfig,
    }),
}));

jest.mock('@/features/lan-servers/internal/lanServerService', () => ({
  getLanServerService: () => ({
    save: mockSave,
    select: mockSelect,
    getDraft: jest.fn(),
    remove: jest.fn(),
  }),
}));

jest.mock('@/features/lan-servers/handoff', () => ({
  useLanQrScannerStore: {
    getState: () => ({ open: jest.fn() }),
  },
}));

jest.mock('@/features/lan-servers/probeLanServers', () => ({
  probeLanServers: jest.fn(),
}));

type EditorState = ReturnType<typeof useLanServerEditor>;
let current!: EditorState;
let renderer: ReactTestRenderer | null = null;

function Harness({ selectAfterSave = false }: { selectAfterSave?: boolean }) {
  current = useLanServerEditor({
    visible: true,
    serverId: null,
    selectAfterSave,
    onFinished: mockFinished,
  });
  return null;
}

async function fillAndSave() {
  act(() => {
    current.setName('New Mac');
    current.updateUrl(0, 'http://new.local:42720');
    current.setUsername('mobile');
    current.setPassword('secret');
  });
  await act(async () => current.save());
}

describe('useLanServerEditor select-after-save policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue({
      id: 'new-server',
      name: 'New Mac',
      urls: ['http://new.local:42720'],
      username: 'mobile',
      allowInsecureTls: false,
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = null;
  });

  it('selects a server added from Home before refreshing settings', async () => {
    act(() => {
      renderer = TestRenderer.create(<Harness selectAfterSave />);
    });

    await fillAndSave();

    expect(mockSelect).toHaveBeenCalledWith('new-server');
    expect(mockSelect.mock.invocationCallOrder[0]).toBeLessThan(
      mockLoadConfig.mock.invocationCallOrder[0]
    );
    expect(mockFinished).toHaveBeenCalledTimes(1);
  });

  it('preserves the current server when Settings saves another profile', async () => {
    act(() => {
      renderer = TestRenderer.create(<Harness />);
    });

    await fillAndSave();

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockLoadConfig).toHaveBeenCalledTimes(1);
  });

  it('only marks the editor dirty after the user changes a field', () => {
    act(() => {
      renderer = TestRenderer.create(<Harness />);
    });

    expect(current.isDirty).toBe(false);

    act(() => current.setName('Changed name'));

    expect(current.isDirty).toBe(true);
  });
});
