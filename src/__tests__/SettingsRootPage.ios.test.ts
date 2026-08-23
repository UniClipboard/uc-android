import fs from 'fs';
import path from 'path';

const settingsRootPage = fs.readFileSync(
  path.resolve(__dirname, '../screens/settings/ios/SettingsRootPage.tsx'),
  'utf8'
);

describe('iOS settings root page', () => {
  it('does not refresh keyboard status whenever a sub-page returns', () => {
    expect(settingsRootPage).not.toContain('active = true');
    expect(settingsRootPage).not.toContain('if (active) refreshKeyboard();');
  });

  it('shows the native version together with the iOS build number', () => {
    expect(settingsRootPage).toContain("import { APP_VERSION_WITH_BUILD } from '@/constants'");
    expect(settingsRootPage).toContain('{APP_VERSION_WITH_BUILD}');
    expect(settingsRootPage).not.toContain('{APP_VERSION}</SwiftUIText>');
  });
});
