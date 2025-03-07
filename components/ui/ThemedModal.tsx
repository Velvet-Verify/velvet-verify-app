// components/ui/ThemedModal.tsx
import React from 'react';
import { Modal, ModalProps, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from 'styled-components/native';

/**
 * Props:
 * - `useBlur`: If true, wraps children in a BlurView (useful for your SubmitTestResults modal).
 * - `children`: The modal’s contents.
 * - All other ModalProps (visible, onRequestClose, etc.) can still be passed normally.
 */
type ThemedModalProps = ModalProps & {
  children: React.ReactNode;
  useBlur?: boolean;
};

export function ThemedModal({ children, useBlur = false, ...rest }: ThemedModalProps) {
  const theme = useTheme();

  return (
    <Modal
      {...rest}
      // The two props below ensure iOS displays the modal above other content.
      transparent
      presentationStyle="overFullScreen"
      animationType="slide"
    >
      {useBlur ? (
        <BlurView intensity={50} style={theme.modalBackground}>
          <View style={theme.modalContainer}>{children}</View>
        </BlurView>
      ) : (
        <View style={theme.modalBackground}>
          <View style={theme.modalContainer}>{children}</View>
        </View>
      )}
    </Modal>
  );
}
