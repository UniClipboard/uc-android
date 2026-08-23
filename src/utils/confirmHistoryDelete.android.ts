import { Alert } from 'react-native';

export interface ConfirmHistoryDeleteOptions {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
}

export function confirmHistoryDelete({
  title,
  message,
  cancelLabel,
  confirmLabel,
}: ConfirmHistoryDeleteOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
