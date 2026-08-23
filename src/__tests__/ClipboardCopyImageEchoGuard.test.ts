import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('copyToLocalClipboard image echo guard', () => {
  let getClipboardContent: jest.Mock;
  let setImageContent: jest.Mock;
  let setLastContent: jest.Mock;
  let pausePolling: jest.Mock;
  let resumePolling: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    getClipboardContent = jest.fn().mockResolvedValue({
      type: 'Image',
      text: 'image.png',
      profileHash: 'IOS_REENCODED_HASH',
      localClipboardHash: 'IOS_REENCODED_HASH',
      fileUri: 'file:///cache/ios-reencoded.png',
      fileName: 'image.png',
      fileSize: 529600,
      hasData: true,
      timestamp: 456,
    });
    setImageContent = jest.fn().mockResolvedValue(undefined);
    setLastContent = jest.fn().mockResolvedValue(undefined);
    pausePolling = jest.fn();
    resumePolling = jest.fn();

    jest.doMock('@/features/clipboard', () => ({
      clipboardManager: {
        getClipboardContent,
        setClipboardContent: jest.fn(),
        setImageContent,
      },
      clipboardMonitor: {
        pausePolling,
        resumePolling,
        setLastContent,
      },
    }));
  });

  it('watermarks the actual iOS image before clipboard monitoring resumes', async () => {
    const { copyToLocalClipboard } = require('../utils/clipboard');
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

    expect(setImageContent).toHaveBeenCalledWith(original.fileUri);
    expect(getClipboardContent).toHaveBeenCalledTimes(1);
    expect(setLastContent).toHaveBeenCalledWith({
      ...original,
      localClipboardHash: 'IOS_REENCODED_HASH',
    });
    expect(setLastContent.mock.invocationCallOrder[0]).toBeLessThan(
      resumePolling.mock.invocationCallOrder[0]
    );
  });

  it('keeps the card copy successful when the post-write image read is unavailable', async () => {
    const { copyToLocalClipboard } = require('../utils/clipboard');
    getClipboardContent.mockRejectedValueOnce(new Error('pasteboard read unavailable'));
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
    expect(setLastContent).toHaveBeenCalledWith(original);
    expect(resumePolling).toHaveBeenCalledTimes(1);
  });
});
