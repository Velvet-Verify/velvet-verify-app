// components/ui/ThemedModal.tsx
import React from 'react';
import { Modal, ModalProps, View, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from 'styled-components/native';

type ThemedModalProps = ModalProps & {
  children: React.ReactNode;
  useBlur?: boolean;
};

export function ThemedModal({ children, useBlur = false, ...rest }: ThemedModalProps) {
  const theme = useTheme();
  return (
    <Modal
      {...rest}
      transparent
      presentationStyle="overFullScreen"
      animationType="slide"
    >
      {useBlur ? (
        <BlurView intensity={50} style={theme.modalBackground}>
          <View style={theme.modalContainer}>
            {children}
          </View>
        </BlurView>
      ) : (
        <View style={theme.modalBackground}>
          <View style={theme.modalContainer}>
            {children}
          </View>
        </View>
      )}
    </Modal>
  );
}