import { OutlinedTextField, Text, useNativeState } from '@expo/ui/jetpack-compose';
import type { TextFieldKeyboardType, TextFieldColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useCallback, useEffect, useRef } from 'react';

export interface AppTextFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  secure?: boolean;
  keyboardType?: TextFieldKeyboardType;
  fullWidth?: boolean;
  colors?: TextFieldColors;
}

export function AppTextField({
  value,
  onChangeText,
  placeholder,
  label,
  disabled,
  secure,
  keyboardType,
  fullWidth,
  colors,
}: AppTextFieldProps) {
  const nativeValue = useNativeState(value);
  const latestNativeValue = useRef(value);
  useEffect(() => {
    if (value === latestNativeValue.current) return;
    latestNativeValue.current = value;
    nativeValue.set(value);
  }, [nativeValue, value]);
  const handleValueChange = useCallback(
    (nextValue: string) => {
      latestNativeValue.current = nextValue;
      onChangeText(nextValue);
    },
    [onChangeText]
  );

  return (
    <OutlinedTextField
      value={nativeValue}
      onValueChange={handleValueChange}
      enabled={disabled !== undefined ? !disabled : undefined}
      singleLine
      visualTransformation={secure ? 'password' : undefined}
      keyboardOptions={{ keyboardType: secure ? 'password' : keyboardType }}
      colors={colors}
      modifiers={fullWidth ? [fillMaxWidth()] : undefined}
    >
      {label ? (
        <OutlinedTextField.Label>
          <Text>{label}</Text>
        </OutlinedTextField.Label>
      ) : null}
      {placeholder ? (
        <OutlinedTextField.Placeholder>
          <Text>{placeholder}</Text>
        </OutlinedTextField.Placeholder>
      ) : null}
    </OutlinedTextField>
  );
}
