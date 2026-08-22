import { describe, expect, it, jest } from '@jest/globals';

function loadApplier():
  | (new (dependencies: unknown) => {
      apply(input: unknown): Promise<void>;
    })
  | undefined {
  try {
    return require('../features/lan-sync/internal/lanRemoteTextApplier').LanRemoteTextApplier;
  } catch {
    return undefined;
  }
}

describe('LanRemoteTextApplier', () => {
  it('writes remote text and history while arming the anti-echo guards', async () => {
    const LanRemoteTextApplier = loadApplier();
    expect(LanRemoteTextApplier).toBeDefined();
    if (!LanRemoteTextApplier) return;
    const dependencies = {
      pauseClipboardMonitoring: jest.fn(),
      resumeClipboardMonitoring: jest.fn(),
      setClipboardContent: jest.fn(async () => undefined),
      setClipboardWatermark: jest.fn(async () => undefined),
      noteApplied: jest.fn(),
      clearActivate: jest.fn(async () => undefined),
      addHistoryItem: jest.fn(async (item: unknown) => item),
      setCurrentContentDisplay: jest.fn(),
    };
    const applier = new LanRemoteTextApplier(dependencies);

    await applier.apply({
      text: 'from desktop',
      profileHash: 'REMOTE_HASH',
      contentId: 'blake3v1:remote',
      size: 12,
    });

    const content = {
      type: 'Text',
      text: 'from desktop',
      profileHash: 'REMOTE_HASH',
      localClipboardHash: 'REMOTE_HASH',
      fileSize: 12,
      hasData: false,
      timestamp: expect.any(Number),
    };
    expect(dependencies.setClipboardContent).toHaveBeenCalledWith(content);
    expect(dependencies.setClipboardWatermark).toHaveBeenCalledWith(content);
    expect(dependencies.noteApplied).toHaveBeenCalledWith('REMOTE_HASH');
    expect(dependencies.clearActivate).toHaveBeenCalledTimes(1);
    expect(dependencies.addHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Text',
        text: 'from desktop',
        profileHash: 'REMOTE_HASH',
        syncStatus: 1,
        from: 'server',
        contentId: 'blake3v1:remote',
      })
    );
    expect(dependencies.setCurrentContentDisplay).toHaveBeenCalledWith(content);
    expect(dependencies.pauseClipboardMonitoring).toHaveBeenCalledTimes(1);
    expect(dependencies.resumeClipboardMonitoring).toHaveBeenCalledTimes(1);
  });

  it('always resumes clipboard monitoring after an apply failure', async () => {
    const LanRemoteTextApplier = loadApplier();
    expect(LanRemoteTextApplier).toBeDefined();
    if (!LanRemoteTextApplier) return;
    const failure = new Error('pasteboard denied');
    const dependencies = {
      pauseClipboardMonitoring: jest.fn(),
      resumeClipboardMonitoring: jest.fn(),
      setClipboardContent: jest.fn(async () => Promise.reject(failure)),
      setClipboardWatermark: jest.fn(async () => undefined),
      noteApplied: jest.fn(),
      clearActivate: jest.fn(async () => undefined),
      addHistoryItem: jest.fn(async (item: unknown) => item),
      setCurrentContentDisplay: jest.fn(),
    };
    const applier = new LanRemoteTextApplier(dependencies);

    await expect(applier.apply({ text: 'remote', profileHash: 'HASH', size: 6 })).rejects.toThrow(
      'pasteboard denied'
    );
    expect(dependencies.resumeClipboardMonitoring).toHaveBeenCalledTimes(1);
  });
});
