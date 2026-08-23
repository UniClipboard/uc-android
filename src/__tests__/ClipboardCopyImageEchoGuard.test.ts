import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('copyToLocalClipboard image echo guard', () => {
  let setImageContent: jest.Mock;
  let setLastContent: jest.Mock;
  let pausePolling: jest.Mock;
  let resumePolling: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    setImageContent = jest.fn().mockResolvedValue(undefined);
    setLastContent = jest.fn().mockResolvedValue(undefined);
    pausePolling = jest.fn();
    resumePolling = jest.fn();

    jest.doMock('@/features/clipboard', () => ({
      clipboardManager: {
        setClipboardContent: jest.fn(),
        setImageContent,
        setFileContent: jest.fn(),
      },
      clipboardMonitor: {
        pausePolling,
        resumePolling,
        setLastContent,
      },
    }));
  });

  it('returns after the native image write without waiting for watermark persistence', async () => {
    const { copyToLocalClipboard } = require('../utils/clipboard');
    let finishPersistence!: () => void;
    setLastContent.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishPersistence = resolve))
    );
    const original = {
      type: 'Image' as const,
      text: 'image.png',
      profileHash: 'REMOTE_HASH',
      localClipboardHash: 'REMOTE_HASH',
      fileUri: 'file:///history/remote-original.png',
      fileName: 'image.png',
      fileSize: 982890,
      hasData: true,
      timestamp: 123,
    };

    await expect(copyToLocalClipboard(original)).resolves.toEqual({
      success: true,
      message: expect.any(String),
    });

    expect(setImageContent).toHaveBeenCalledWith(original.fileUri, original.localClipboardHash);
    expect(setLastContent).toHaveBeenCalledWith(original);
    expect(resumePolling).toHaveBeenCalledTimes(1);
    finishPersistence();
  });

  it('writes an iOS file URL to the system clipboard', async () => {
    const { copyToLocalClipboard } = require('../utils/clipboard');
    const { clipboardManager } = require('@/features/clipboard');
    const file = {
      type: 'File' as const,
      text: 'plan.pdf',
      profileHash: 'FILE_HASH',
      localClipboardHash: 'FILE_HASH',
      fileUri: 'file:///history/plan.pdf',
      fileName: 'plan.pdf',
      fileSize: 2048,
      hasData: true,
      timestamp: 123,
    };

    await expect(copyToLocalClipboard(file)).resolves.toEqual({
      success: true,
      message: expect.any(String),
    });
    expect(clipboardManager.setFileContent).toHaveBeenCalledWith(
      file.fileUri,
      file.localClipboardHash
    );
    expect(setLastContent).toHaveBeenCalledWith(file);
  });
});
