import { requireNativeModule } from 'expo-modules-core';

const NativeModule = requireNativeModule('QrScanner');

export function scanQRCode(cancelLabel: string, hint: string): Promise<string | null> {
  return NativeModule.scanQRCode(cancelLabel, hint);
}
