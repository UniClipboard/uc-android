import fs from 'fs';
import path from 'path';

const settingsScreen = fs.readFileSync(
  path.resolve(__dirname, '../screens/SettingsScreen.ios.tsx'),
  'utf8'
);

describe('iOS settings page navigation', () => {
  it('keeps the scrollable root page stationary while a sub-page is open', () => {
    expect(settingsScreen).toContain('function SettingsSubPageOverlay');
    expect(settingsScreen).not.toContain('offset({ x: atRoot ? 0 : -width * 0.3 })');
    expect(settingsScreen).toContain('offset({ x: isPresented ? 0 : width })');
    expect(settingsScreen).toContain('animation(PUSH_SPRING, isPresented)');
  });

  it('owns space setup presentation above the sliding space page', () => {
    expect(settingsScreen).toContain(
      'const [spaceSetupMode, setSpaceSetupMode] = useState<AddSyncConnectionMode | null>(null)'
    );
    expect(settingsScreen).toContain('onOpenSetup={setSpaceSetupMode}');
    expect(settingsScreen).toContain('<AddSyncConnectionSheet');
    expect(settingsScreen).toContain('persistentPresentation');
  });

  it('returns nested connection pages to the sync method page', () => {
    expect(settingsScreen).toContain(
      'const [pageStack, setPageStack] = useState<SettingsSubPage[]>([])'
    );
    expect(settingsScreen).toContain('setPageStack((current) => [...current, page])');
    expect(settingsScreen).toContain('const backToPreviousPage = useCallback');
    expect(settingsScreen).toContain('setPageStack((current) => current.slice(0, -1))');
    expect(settingsScreen).toContain('<SpacePage');
    expect(settingsScreen).toContain('onBack={backToPreviousPage}');
  });
});
