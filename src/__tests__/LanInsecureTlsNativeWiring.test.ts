import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { patchMainApplicationForLanInsecureTls } from '../../plugins/withLanInsecureTls';

describe('LAN self-signed HTTPS native wiring', () => {
  it('persists the Android trust wiring through the Expo config plugin', () => {
    const pluginPath = path.join(process.cwd(), 'plugins/withLanInsecureTls.ts');
    expect(fs.existsSync(pluginPath)).toBe(true);
    const appConfig = fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf8');
    expect(appConfig).toContain('./plugins/build/withLanInsecureTls.js');
  });

  it('registers the Android opt-in trust manager before React Native starts', () => {
    const source = patchMainApplicationForLanInsecureTls(`package app.uniclipboard.android

import android.app.Application

class MainApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
`);

    expect(source).toContain('ReactNativeBlobUtilUtils.sharedTrustManager');
    expect(source.indexOf('ReactNativeBlobUtilUtils.sharedTrustManager')).toBeLessThan(
      source.indexOf('loadReactNative(this)')
    );
  });
});
