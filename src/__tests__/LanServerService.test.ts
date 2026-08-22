import { describe, expect, it, jest } from '@jest/globals';

function loadLanServerService():
  | (new (dependencies: unknown) => {
      save(draft: unknown, serverId?: string): Promise<unknown>;
      getDraft(serverId: string): Promise<unknown>;
      remove(serverId: string): Promise<void>;
      select(serverId: string): Promise<void>;
    })
  | undefined {
  try {
    return require('../features/lan-servers/internal/lanServerService').LanServerService;
  } catch {
    return undefined;
  }
}

function loadLanServerModule():
  | {
      configureLanServerService(dependencies: unknown): unknown;
      getLanServerService(): unknown;
    }
  | undefined {
  try {
    return require('../features/lan-servers/internal/lanServerService');
  } catch {
    return undefined;
  }
}

function dependencies() {
  let state = { servers: [] as unknown[], activeServerId: null as string | null };
  const secrets = new Map<string, string>();
  let nextWriteError: Error | null = null;
  return {
    settings: {
      read: jest.fn(async () => state),
      write: jest.fn(async (next: typeof state) => {
        if (nextWriteError) {
          const error = nextWriteError;
          nextWriteError = null;
          throw error;
        }
        state = next;
      }),
    },
    secrets: {
      get: jest.fn(async (id: string) => secrets.get(id) ?? null),
      set: jest.fn(async (id: string, password: string) => {
        secrets.set(id, password);
      }),
      delete: jest.fn(async (id: string) => {
        secrets.delete(id);
      }),
    },
    createId: jest.fn(() => 'lan-1'),
    getState: () => state,
    getSecret: (id: string) => secrets.get(id),
    failNextWrite: (error: Error) => {
      nextWriteError = error;
    },
  };
}

describe('LanServerService', () => {
  it('stores server metadata separately from its password', async () => {
    const LanServerService = loadLanServerService();
    expect(LanServerService).toBeDefined();
    if (!LanServerService) return;

    const deps = dependencies();
    const service = new LanServerService(deps);

    await expect(
      service.save({
        name: 'Home',
        urls: [' http://192.168.1.5:42720 ', 'https://home.example.com/'],
        username: ' mobile_user ',
        password: 'secret password',
        allowInsecureTls: false,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'lan-1',
        name: 'Home',
        urls: ['http://192.168.1.5:42720', 'https://home.example.com'],
        username: 'mobile_user',
      })
    );

    expect(deps.getState()).toEqual({
      servers: [
        {
          id: 'lan-1',
          name: 'Home',
          urls: ['http://192.168.1.5:42720', 'https://home.example.com'],
          username: 'mobile_user',
          allowInsecureTls: false,
        },
      ],
      activeServerId: 'lan-1',
    });
    expect(JSON.stringify(deps.getState())).not.toContain('secret password');
    expect(deps.getSecret('lan-1')).toBe('secret password');
  });

  it('edits a server without changing its stable id', async () => {
    const LanServerService = loadLanServerService();
    expect(LanServerService).toBeDefined();
    if (!LanServerService) return;

    const deps = dependencies();
    const service = new LanServerService(deps);
    await service.save({
      name: 'Home',
      urls: ['http://home.local:42720'],
      username: 'old-user',
      password: 'old-password',
      allowInsecureTls: false,
    });

    await service.save(
      {
        name: 'Home updated',
        urls: ['https://home.example.com'],
        username: 'new-user',
        password: 'new-password',
        allowInsecureTls: true,
      },
      'lan-1'
    );

    expect(deps.getState().servers).toEqual([
      expect.objectContaining({
        id: 'lan-1',
        name: 'Home updated',
        username: 'new-user',
        allowInsecureTls: true,
      }),
    ]);
    expect(deps.getSecret('lan-1')).toBe('new-password');
    await expect(service.getDraft('lan-1')).resolves.toEqual({
      name: 'Home updated',
      urls: ['https://home.example.com'],
      username: 'new-user',
      password: 'new-password',
      allowInsecureTls: true,
    });
  });

  it('restores the previous password when an edit cannot persist metadata', async () => {
    const LanServerService = loadLanServerService();
    expect(LanServerService).toBeDefined();
    if (!LanServerService) return;

    const deps = dependencies();
    const service = new LanServerService(deps);
    await service.save({
      name: 'Home',
      urls: ['http://home.local:42720'],
      username: 'user',
      password: 'old-password',
      allowInsecureTls: false,
    });
    deps.failNextWrite(new Error('settings write failed'));

    await expect(
      service.save(
        {
          name: 'Broken edit',
          urls: ['https://new.example.com'],
          username: 'new-user',
          password: 'new-password',
          allowInsecureTls: false,
        },
        'lan-1'
      )
    ).rejects.toThrow('settings write failed');

    expect(deps.getSecret('lan-1')).toBe('old-password');
    expect(deps.getState().servers).toEqual([
      expect.objectContaining({ name: 'Home', username: 'user' }),
    ]);
  });

  it('removes a server and selects the next available server', async () => {
    const LanServerService = loadLanServerService();
    expect(LanServerService).toBeDefined();
    if (!LanServerService) return;

    const deps = dependencies();
    deps.createId.mockReturnValueOnce('lan-1').mockReturnValueOnce('lan-2');
    const service = new LanServerService(deps);
    const draft = (name: string) => ({
      name,
      urls: [`http://${name.toLowerCase()}.local:42720`],
      username: 'user',
      password: `${name}-password`,
      allowInsecureTls: false,
    });
    await service.save(draft('Home'));
    await service.save(draft('Office'));

    await service.remove('lan-1');

    expect(deps.getState()).toEqual({
      servers: [expect.objectContaining({ id: 'lan-2' })],
      activeServerId: 'lan-2',
    });
    expect(deps.getSecret('lan-1')).toBeUndefined();
  });

  it('rejects selecting an unknown server', async () => {
    const LanServerService = loadLanServerService();
    expect(LanServerService).toBeDefined();
    if (!LanServerService) return;

    const deps = dependencies();
    const service = new LanServerService(deps);

    await expect(service.select('missing')).rejects.toThrow('LAN server not found');
    expect(deps.settings.write).not.toHaveBeenCalled();
  });

  it('configures one shared LAN server service', () => {
    const module = loadLanServerModule();
    expect(module).toBeDefined();
    if (!module) return;
    const deps = dependencies();

    const service = module.configureLanServerService(deps);

    expect(module.getLanServerService()).toBe(service);
    expect(() => module.configureLanServerService(deps)).toThrow(
      'The LAN server service is already configured'
    );
  });
});
