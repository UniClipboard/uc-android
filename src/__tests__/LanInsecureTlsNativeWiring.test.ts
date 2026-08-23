import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

describe('LAN self-signed HTTPS native wiring', () => {
  it('persists the Android trust wiring through the Expo config plugin', () => {
    const pluginPath = path.join(process.cwd(), 'plugins/withLanInsecureTls.ts');
    expect(fs.existsSync(pluginPath)).toBe(true);
    const appConfig = fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf8');
    expect(appConfig).toContain('./plugins/build/withLanInsecureTls.js');
  });

  it('registers the Android opt-in trust manager before React Native starts', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'android/app/src/main/java/app/uniclipboard/android/MainApplication.kt'
      ),
      'utf8'
    );

    expect(source).toContain('ReactNativeBlobUtilUtils.sharedTrustManager');
    expect(source.indexOf('ReactNativeBlobUtilUtils.sharedTrustManager')).toBeLessThan(
      source.indexOf('loadReactNative(this)')
    );
  });
});
