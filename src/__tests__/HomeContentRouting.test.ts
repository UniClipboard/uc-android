import fs from 'fs';
import path from 'path';

const controller = fs.readFileSync(
  path.resolve(__dirname, '../screens/useHomeController.ts'),
  'utf8'
);
const homeChrome = fs.readFileSync(path.resolve(__dirname, '../screens/HomeChrome.tsx'), 'utf8');
const topBarTypes = fs.readFileSync(
  path.resolve(__dirname, '../components/HomeTopBar.types.ts'),
  'utf8'
);
const topBars = ['android', 'ios'].map((platform) =>
  fs.readFileSync(path.resolve(__dirname, `../components/HomeTopBar.${platform}.tsx`), 'utf8')
);

describe('home content routing', () => {
  it('routes clipboard, image, and file sends through the unified sync runtime', () => {
    expect(controller).toContain('getUnifiedSyncRuntime');
    expect(controller).toContain('.sendCurrentClipboard()');
    expect(controller).toContain('.sendImportedAsset(');
  });

  it('routes manual refresh through the unified sync runtime', () => {
    expect(controller).toContain('getUnifiedSyncRuntime().synchronize()');
    expect(controller).not.toContain('getUnifiedEngineService');
  });

  it('does not contain the retired upload paths', () => {
    expect(controller).not.toContain('getClipboardSyncService().triggerUpload()');
    expect(controller).not.toContain('BackgroundUploadManager.enqueue(');
  });

  it('waits for imported asset delivery before showing its final result', () => {
    expect(controller).toContain(
      'const sendResult = await getUnifiedSyncRuntime().sendImportedAsset('
    );
  });

  it('keeps the empty history message independent from connection status', () => {
    expect(controller).not.toContain('deriveP2pConnectionStatus');
    expect(controller).toContain('useUnifiedEngineStore');
    expect(controller).not.toContain('syncChannel');
    expect(controller).not.toContain('refreshSelectedConnection');
  });

  it('keeps My Space management out of the Home header', () => {
    for (const topBar of topBars) {
      expect(topBar).not.toContain("t('topBar.mySpace')");
      expect(topBar).not.toContain('onOpenSpace');
    }

    expect(topBarTypes).not.toContain('onOpenSpace');
    expect(homeChrome).not.toContain('setShowMySpace');
    expect(controller).not.toContain('showMySpace');
    expect(controller).not.toContain('setShowMySpace');
  });
});
