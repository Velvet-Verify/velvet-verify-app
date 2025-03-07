// components/ui/ThemedButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps } from 'react-native';
import { useTheme } from 'styled-components/native';

type ButtonVariant = 'primary' | 'secondary';

interface ThemedButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}

export function ThemedButton({ title, variant = 'primary', disabled, style, ...rest }: ThemedButtonProps) {
  const theme = useTheme();
  const buttonStyle = variant === 'primary' ? theme.buttonPrimary : theme.buttonSecondary;

  return (
    <TouchableOpacity
      style={[buttonStyle, styles.button, disabled && styles.disabled, style]}
      disabled={disabled}
      {...rest}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});
