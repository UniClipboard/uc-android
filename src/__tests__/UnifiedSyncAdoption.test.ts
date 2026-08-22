import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const projectRoot = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('unified sync adoption', () => {
  it('constructs the P2P adapter once in the application composition root', () => {
    const composition = source('src/app/runtime/composition.ts');

    expect(composition).toContain('new P2pSyncAdapter');
    expect(composition).toContain('configureUnifiedSyncRuntime');
    expect(composition).toContain('sync: getUnifiedSyncRuntime');
  });

  it.each([
    'src/screens/useHomeController.ts',
    'src/screens/ProcessTextScreen.tsx',
    'src/screens/QuickTileLoadingScreen.tsx',
    'src/components/ShareSendSheet/useShareSendController.ts',
  ])('%s sends through the unified sync runtime', (relativePath) => {
    const file = source(relativePath);

    expect(file).toContain('getUnifiedSyncRuntime');
    expect(file).not.toContain('getUnifiedContentService');
  });

  it('keeps the P2P content implementation private to composition', () => {
    const consumers = [
      source('src/screens/useHomeController.ts'),
      source('src/screens/ProcessTextScreen.tsx'),
      source('src/screens/QuickTileLoadingScreen.tsx'),
      source('src/components/ShareSendSheet/useShareSendController.ts'),
    ].join('\n');

    expect(consumers).not.toContain("from '@/features/transfer/internal/contentTransfer'");
  });

  it('routes automatic clipboard observations through the unified runtime', () => {
    const composition = source('src/app/runtime/composition.ts');

    expect(composition).toContain('getUnifiedSyncRuntime().observeClipboardChange');
    expect(composition).not.toContain(
      'configureClipboardObserver((dispatch) => nativeEngine.observeClipboardChange(dispatch))'
    );
  });
});
