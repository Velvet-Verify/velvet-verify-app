// components/ui/ThemedModal.tsx
import React from 'react';
import { Modal, ModalProps, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from 'styled-components/native';

type ThemedModalProps = ModalProps & {
  children: React.ReactNode;
  useBlur?: boolean;
};

export function ThemedModal({ children, useBlur = false, ...rest }: ThemedModalProps) {
  const theme = useTheme();

  const Container = (
    <View style={[theme.modalBackground, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={theme.modalContainer}>{children}</View>
    </View>
  );

  return (
    <Modal {...rest} transparent animationType="slide" presentationStyle="overFullScreen">
      {useBlur ? <BlurView intensity={50} style={{ flex: 1 }}>{Container}</BlurView> : Container}
    </Modal>
  );
}