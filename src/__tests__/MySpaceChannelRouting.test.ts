import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('Home My Space channel routing', () => {
  const platforms = ['android', 'ios'] as const;

  it('mounts exactly one channel branch and resets it when the selection changes', () => {
    for (const platform of platforms) {
      const sheet = read(`components/MySpaceSheet.${platform}.tsx`);
      expect(sheet).toContain('useSettingsStore');
      expect(sheet).toContain("config?.syncChannel ?? 'lan'");
      expect(sheet).toContain('key={syncChannel}');
      expect(sheet).toContain('<LanMySpaceContent');
      expect(sheet).toContain('<P2pMySpaceContent');
      expect(sheet).not.toContain('Platform.OS');
    }
  });

  it('keeps the outer sheet layout shared while channel display stays independent', () => {
    for (const platform of platforms) {
      const layout = read(`components/MySpaceLayout.${platform}.tsx`);
      const lan = read(`components/LanMySpaceContent.${platform}.tsx`);
      const p2p = read(`components/P2pMySpaceContent.${platform}.tsx`);

      expect(lan).toContain('<MySpaceLayout');
      expect(p2p).toContain('<MySpaceLayout');
      expect(lan).toContain('useLanMySpaceSheet');
      expect(lan).not.toContain('useP2pMySpaceSheet');
      expect(p2p).toContain('useP2pMySpaceSheet');
      expect(p2p).not.toContain('useLanMySpaceSheet');
      expect(layout).not.toContain('syncChannel');
    }
  });

  it('reuses the server editor for Regular Sync instead of copying its form', () => {
    for (const platform of platforms) {
      const lan = read(`components/LanMySpaceContent.${platform}.tsx`);
      expect(lan).toContain('<LanServerEditorSheet');
      expect(lan).toContain("setEditingServerId('new')");
      expect(lan).toContain('setEditingServerId(server.id)');
    }

    const settingsPage = read('screens/settings/LanServersPage.android.tsx');
    expect(settingsPage).toContain('<LanServerEditorSheet');
    expect(settingsPage).not.toContain('useLanServerEditor({');
    expect(settingsPage).not.toContain('<ModalBottomSheet');
  });

  it('shows the current server, address, and connection state on both platforms', () => {
    for (const platform of platforms) {
      const lan = read(`components/LanMySpaceContent.${platform}.tsx`);
      expect(lan).toContain("'syncChannel.currentConnection'");
      expect(lan).toContain('server.address');
      expect(lan).toContain('statusLabel(server.status');
      expect(lan).toContain("'syncChannel.notConfigured'");
    }
  });

  it('shows the iOS server editor inside the existing My Space sheet', () => {
    const lan = read('components/LanMySpaceContent.ios.tsx');
    const layout = read('components/MySpaceLayout.ios.tsx');
    const editor = read('screens/settings/ios/LanServerEditorSheet.tsx');

    expect(lan).toContain('page={editorPage}');
    expect(lan).not.toMatch(/supplementary=\{[\s\S]*?<LanServerEditorSheet/);
    expect(layout).toContain('page ??');
    expect(editor).toContain('if (props.embedded) return page;');
    expect(editor).toContain("systemName={props.embedded ? 'chevron.left' : 'xmark'}");
    expect(editor).toContain("props.embedded ? 'action.back' : 'action.cancel'");
  });
});
