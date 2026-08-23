import { describe, expect, it, jest } from '@jest/globals';

function loadApplier():
  | (new (dependencies: unknown) => {
      apply(input: unknown): Promise<void>;
    })
  | undefined {
  try {
    return require('../features/lan-sync/internal/lanRemoteContentApplier').LanRemoteContentApplier;
  } catch {
    return undefined;
  }
}

function dependencies() {
  return {
    pauseClipboardMonitoring: jest.fn(),
    resumeClipboardMonitoring: jest.fn(),
    setClipboardContent: jest.fn(async () => undefined),
    readClipboardContent: jest.fn(async () => null),
    setClipboardWatermark: jest.fn(async () => undefined),
    noteApplied: jest.fn(),
    clearActivate: jest.fn(async () => undefined),
    addHistoryItem: jest.fn(async (item: { fileUri?: string }) => ({
      ...item,
      fileUri: item.fileUri?.replace('/cache/', '/history/'),
    })),
    setCurrentContentDisplay: jest.fn(),
    readTextFile: jest.fn(async () => 'full remote text'),
  };
}

describe('LanRemoteContentApplier', () => {
  it('writes remote text and history while arming the anti-echo guards', async () => {
    const LanRemoteContentApplier = loadApplier();
    expect(LanRemoteContentApplier).toBeDefined();
    if (!LanRemoteContentApplier) return;
    const deps = dependencies();
    const applier = new LanRemoteContentApplier(deps);

    await applier.apply({
      type: 'Text',
      text: 'from desktop',
      profileHash: 'REMOTE_HASH',
      contentId: 'blake3v1:remote',
      hasData: false,
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
    expect(deps.setClipboardContent).toHaveBeenCalledWith(content);
    expect(deps.setClipboardWatermark).toHaveBeenCalledWith(content);
    expect(deps.noteApplied).toHaveBeenCalledWith('REMOTE_HASH');
    expect(deps.clearActivate).toHaveBeenCalledTimes(1);
    expect(deps.addHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Text',
        text: 'from desktop',
        profileHash: 'REMOTE_HASH',
        syncStatus: 1,
        from: 'server',
        contentId: 'blake3v1:remote',
      })
    );
    expect(deps.setCurrentContentDisplay).toHaveBeenCalledWith(content);
    expect(deps.pauseClipboardMonitoring).toHaveBeenCalledTimes(1);
    expect(deps.resumeClipboardMonitoring).toHaveBeenCalledTimes(1);
  });

  it('reads full long text from the payload while retaining its preview in history', async () => {
    const LanRemoteContentApplier = loadApplier();
    expect(LanRemoteContentApplier).toBeDefined();
    if (!LanRemoteContentApplier) return;
    const deps = dependencies();
    const applier = new LanRemoteContentApplier(deps);

    await applier.apply({
      type: 'Text',
      text: 'preview',
      profileHash: 'LONG_HASH',
      hasData: true,
      dataName: 'text_LONG_HASH.txt',
      fileUri: 'file:///cache/text_LONG_HASH.txt',
      size: 12000,
    });

    expect(deps.readTextFile).toHaveBeenCalledWith('file:///cache/text_LONG_HASH.txt');
    expect(deps.setClipboardContent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Text', text: 'full remote text', hasData: true })
    );
    expect(deps.addHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'preview',
        dataName: 'text_LONG_HASH.txt',
        fileUri: 'file:///cache/text_LONG_HASH.txt',
      })
    );
  });

  it('writes a remote image to the clipboard and stores the final history path', async () => {
    const LanRemoteContentApplier = loadApplier();
    expect(LanRemoteContentApplier).toBeDefined();
    if (!LanRemoteContentApplier) return;
    const deps = dependencies();
    const applier = new LanRemoteContentApplier(deps);

    await applier.apply({
      type: 'Image',
      text: 'image.png',
      profileHash: 'IMAGE_HASH',
      contentId: 'blake3v1:image',
      hasData: true,
      dataName: 'image.png',
      fileUri: 'file:///cache/image.png',
      size: 321,
    });

    expect(deps.setClipboardContent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Image', fileUri: 'file:///cache/image.png' })
    );
    expect(deps.addHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Image', fileUri: 'file:///cache/image.png' })
    );
    expect(deps.setCurrentContentDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Image', fileUri: 'file:///history/image.png' })
    );
  });

  it('does not treat an iOS-reencoded remote image as a new local copy', async () => {
    const LanRemoteContentApplier = loadApplier();
    expect(LanRemoteContentApplier).toBeDefined();
    if (!LanRemoteContentApplier) return;
    const iosClipboardContent = {
      type: 'Image' as const,
      text: 'image.png',
      profileHash: 'IOS_REENCODED_HASH',
      localClipboardHash: 'IOS_REENCODED_HASH',
      fileUri: 'file:///cache/ios-reencoded.png',
      fileName: 'image.png',
      fileSize: 281141,
      hasData: true,
      timestamp: 123,
    };
    const deps = dependencies();
    deps.readClipboardContent.mockResolvedValue(iosClipboardContent);
    const applier = new LanRemoteContentApplier(deps);

    await applier.apply({
      type: 'Image',
      text: 'image.png',
      profileHash: 'REMOTE_HASH',
      contentId: 'blake3v1:remote-image',
      hasData: true,
      dataName: 'image.png',
      fileUri: 'file:///cache/remote-original.png',
      size: 416829,
    });

    expect(deps.setClipboardWatermark).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Image',
        profileHash: 'REMOTE_HASH',
        localClipboardHash: 'IOS_REENCODED_HASH',
      })
    );
  });

  it('keeps the remote image when the post-write clipboard read is unavailable', async () => {
    const LanRemoteContentApplier = loadApplier();
    expect(LanRemoteContentApplier).toBeDefined();
    if (!LanRemoteContentApplier) return;
    const deps = dependencies();
    deps.readClipboardContent.mockRejectedValueOnce(new Error('pasteboard read unavailable'));
    const applier = new LanRemoteContentApplier(deps);

    await expect(
      applier.apply({
        type: 'Image',
        text: 'image.png',
        profileHash: 'REMOTE_HASH',
        hasData: true,
        dataName: 'image.png',
        fileUri: 'file:///cache/image.png',
        size: 321,
      })
    ).resolves.toBeUndefined();

    expect(deps.setClipboardWatermark).toHaveBeenCalledWith(
      expect.objectContaining({ localClipboardHash: 'REMOTE_HASH' })
    );
    expect(deps.addHistoryItem).toHaveBeenCalledTimes(1);
    expect(deps.resumeClipboardMonitoring).toHaveBeenCalledTimes(1);
  });

  it('stores a remote file in history without replacing the system clipboard', async () => {
    const LanRemoteContentApplier = loadApplier();
    expect(LanRemoteContentApplier).toBeDefined();
    if (!LanRemoteContentApplier) return;
    const deps = dependencies();
    const applier = new LanRemoteContentApplier(deps);

    await applier.apply({
      type: 'File',
      text: 'report.pdf',
      profileHash: 'FILE_HASH',
      hasData: true,
      dataName: 'report.pdf',
      fileUri: 'file:///cache/report.pdf',
      size: 456,
    });

    expect(deps.setClipboardContent).not.toHaveBeenCalled();
    expect(deps.setClipboardWatermark).not.toHaveBeenCalled();
    expect(deps.addHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'File', fileUri: 'file:///cache/report.pdf' })
    );
    expect(deps.setCurrentContentDisplay).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'File', fileUri: 'file:///history/report.pdf' })
    );
  });

  it('always resumes clipboard monitoring after a clipboard apply failure', async () => {
    const LanRemoteContentApplier = loadApplier();
    expect(LanRemoteContentApplier).toBeDefined();
    if (!LanRemoteContentApplier) return;
    const deps = dependencies();
    deps.setClipboardContent.mockRejectedValueOnce(new Error('pasteboard denied'));
    const applier = new LanRemoteContentApplier(deps);

    await expect(
      applier.apply({
        type: 'Text',
        text: 'remote',
        profileHash: 'HASH',
        hasData: false,
        size: 6,
      })
    ).rejects.toThrow('pasteboard denied');
    expect(deps.resumeClipboardMonitoring).toHaveBeenCalledTimes(1);
  });
});
