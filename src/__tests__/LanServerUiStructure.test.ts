import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

function source(relativePath: string): string {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
}

describe('LAN server UI ownership', () => {
  it('routes cold and hot LAN connection links through one redacted handler', () => {
    const app = source('App.tsx');

    expect(app).toContain('ingestLanConnectUrl');
    expect(app).toContain('openLanServerSettings');
    expect(app).toContain('handleLanConnectUrl');
    expect(app.match(/handleLanConnectUrl\(url\)/g)).toHaveLength(2);
    expect(app).not.toMatch(/console\.(?:log|info|warn|error).*connect/i);
  });

  it('keeps the Android QR scanner at the stable application root', () => {
    const app = source('App.tsx');
    const scanner = source('src/components/LanQrScannerModal.tsx');

    expect(app).toContain('LanQrScannerHost');
    expect(app).toContain('<LanQrScannerHost />');
    expect(scanner).toContain('permissionRequested.current = true;');
    expect(scanner).toContain('permissionRequested.current = false;');
  });

  it('presents the iOS scanner above the active native server sheet', () => {
    const host = source('src/components/LanQrScannerHost.ios.tsx');
    const editor = source('src/screens/settings/ios/LanServerEditorSheet.tsx');
    const nativeScanner = source('modules/qr-scanner/ios/QrScannerModule.swift');

    expect(host).toContain('return null');
    expect(editor).toContain("import { scanQRCode } from 'qr-scanner';");
    expect(editor).toContain('await scanQRCode(');
    expect(nativeScanner).toContain(
      'while let presented = topViewController.presentedViewController'
    );
    expect(nativeScanner).toContain('visibleChildViewController');
    expect(nativeScanner).toContain('topViewController.children.reversed()');
    expect(nativeScanner).toContain('scanner.modalPresentationStyle = .fullScreen');
    expect(nativeScanner).toContain('topViewController.present(scanner, animated: true)');
  });

  it('keeps platform navigation policy outside the shared app component', () => {
    const android = source('src/features/lan-servers/openLanServerSettings.android.ts');
    const ios = source('src/features/lan-servers/openLanServerSettings.ios.ts');

    expect(android).toContain("navigateWhenReady('SettingsSub', { section: 'lanServers' })");
    expect(ios).toContain("navigateWhenReady('Settings', { section: 'lanServers' })");
  });

  it('renders the iOS editor from the stable Settings owner', () => {
    const settings = source('src/screens/SettingsScreen.ios.tsx');
    const page = source('src/screens/settings/ios/LanServersPage.tsx');
    const editor = source('src/screens/settings/ios/LanServerEditorSheet.tsx');

    expect(settings).toContain('<LanServersPage');
    expect(settings).toContain('<LanServerEditorSheet');
    expect(settings.indexOf('<LanServerEditorSheet')).toBeGreaterThan(
      settings.indexOf('</SettingsSubPageOverlay>')
    );
    expect(page).toContain('SettingsNavRow');
    expect(page).not.toContain('LanServerEditorSheet');
    expect(editor).toContain('if (value === latestNativeValue.current) return;');
    expect(editor).toContain('onTextChange={handleTextChange}');
    expect(editor).toContain("t('lan.probe.test')");
    expect(editor).toContain('editor.probeResults');
    expect(editor).toContain('systemName="xmark"');
    expect(editor).toContain('systemName="checkmark"');
    expect(editor).toContain('disabled={editor.pending || !editor.canSave}');
    expect(editor).not.toContain("<Button label={t('action.cancel', { ns: 'common' })}");
  });

  it('uses full-width Android list rows and a screen-owned editor sheet', () => {
    const page = source('src/screens/settings/LanServersPage.android.tsx');

    expect(page).toContain('ListItem modifiers={[clickable(');
    expect(page).toContain('<ModalBottomSheet');
    expect(page).toContain('usePendingLanConnectStore');
    expect(page).toContain('verticalScroll()');
    expect(page).toContain("t('lan.probe.test')");
    expect(page).toContain('editor.probeResults');
  });

  it('wraps Android text-field labels and placeholders in Compose text', () => {
    const field = source('src/components/ui/AppTextField.android.tsx');

    expect(field).toContain('<Text>{label}</Text>');
    expect(field).toContain('<Text>{placeholder}</Text>');
    expect(field).toContain('nativeValue.set(value)');
    expect(field).toContain('if (value === latestNativeValue.current) return;');
    expect(field).toContain('onValueChange={handleValueChange}');
    expect(field).toContain("visualTransformation={secure ? 'password' : undefined}");
    expect(field).not.toContain('<OutlinedTextField.Label>{label}</OutlinedTextField.Label>');
    expect(field).not.toContain(
      '<OutlinedTextField.Placeholder>{placeholder}</OutlinedTextField.Placeholder>'
    );
  });

  it('opens LAN server settings from the selected sync method pages', () => {
    const iosPage = source('src/screens/settings/ios/SyncChannelPage.tsx');
    const androidPage = source('src/screens/settings/SyncChannelSection.android.tsx');

    expect(iosPage).toContain("onNavigate('lanServers')");
    expect(androidPage).toContain("openSection('lanServers')");
  });
});
