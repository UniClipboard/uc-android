import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Flashlight, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { parseLanConnectUri, useLanQrScannerStore } from '@/features/lan-servers';

const COLOR_BLACK = '#000000';
const COLOR_WHITE = '#FFFFFF';
const COLOR_DARK_SURFACE = '#111111';
const COLOR_SECONDARY_TEXT = '#D1D1D6';
const COLOR_HEADER_BACKDROP = 'rgba(0,0,0,0.45)';

export function LanQrScannerModal() {
  const { t } = useTranslation('settingsSync');
  const visible = useLanQrScannerStore((state) => state.isVisible);
  const close = useLanQrScannerStore((state) => state.close);
  const complete = useLanQrScannerStore((state) => state.complete);
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scanLocked = useRef(false);
  const permissionRequested = useRef(false);

  useEffect(() => {
    if (!visible) {
      permissionRequested.current = false;
      return;
    }
    scanLocked.current = false;
    setTorchEnabled(false);
  }, [visible]);

  useEffect(() => {
    if (
      !visible ||
      !permission ||
      permission.granted ||
      !permission.canAskAgain ||
      permissionRequested.current
    ) {
      return;
    }
    permissionRequested.current = true;
    void requestPermission();
  }, [permission, requestPermission, visible]);

  const handleScan = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (scanLocked.current) return;
      scanLocked.current = true;
      const parsed = parseLanConnectUri(data ?? '');
      if (!parsed.ok) {
        Alert.alert(t('lan.qr.failedTitle'), t(`lan.qr.errors.${parsed.error}`), [
          {
            text: t('lan.qr.rescan'),
            onPress: () => {
              scanLocked.current = false;
            },
          },
          { text: t('action.cancel', { ns: 'common' }), style: 'cancel', onPress: close },
        ]);
        return;
      }
      complete(parsed.value);
    },
    [close, complete, t]
  );

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchEnabled}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
          />
        ) : (
          <View style={styles.permissionBody}>
            <Text style={styles.permissionTitle}>{t('lan.qr.permissionTitle')}</Text>
            <Text style={styles.permissionText}>{t('lan.qr.permissionBody')}</Text>
            <Pressable
              style={styles.permissionButton}
              onPress={() =>
                permission?.canAskAgain ? void requestPermission() : void Linking.openSettings()
              }
            >
              <Text style={styles.permissionButtonText}>
                {permission?.canAskAgain ? t('lan.qr.requestPermission') : t('lan.qr.openSettings')}
              </Text>
            </Pressable>
          </View>
        )}
        {permission?.granted ? (
          <>
            <View style={styles.mask} pointerEvents="none">
              <View style={styles.scanFrame} />
              <Text style={styles.hint}>{t('lan.qr.hint')}</Text>
            </View>
            <SafeAreaView style={styles.header} edges={['top']}>
              <Pressable accessibilityLabel={t('action.cancel', { ns: 'common' })} onPress={close}>
                <X color="#FFFFFF" size={28} />
              </Pressable>
              <Text style={styles.title}>{t('lan.qr.title')}</Text>
              <Pressable
                accessibilityLabel={t('lan.qr.torch')}
                onPress={() => setTorchEnabled((enabled) => !enabled)}
              >
                <Flashlight color={torchEnabled ? '#FFD60A' : '#FFFFFF'} size={26} />
              </Pressable>
            </SafeAreaView>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR_BLACK },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLOR_HEADER_BACKDROP,
  },
  title: { color: COLOR_WHITE, fontSize: 17, fontWeight: '600' },
  mask: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: COLOR_WHITE,
    borderRadius: 8,
    backgroundColor: `${COLOR_BLACK}00`,
  },
  hint: { marginTop: 24, color: COLOR_WHITE, fontSize: 15 },
  permissionBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: COLOR_DARK_SURFACE,
  },
  permissionTitle: { color: COLOR_WHITE, fontSize: 22, fontWeight: '600', marginBottom: 12 },
  permissionText: {
    color: COLOR_SECONDARY_TEXT,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: COLOR_WHITE,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  permissionButtonText: { color: COLOR_DARK_SURFACE, fontSize: 16, fontWeight: '600' },
});
