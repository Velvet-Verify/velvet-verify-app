// components/ui/NewConnection.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { useTheme } from 'styled-components/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { ThemedButton } from '@/components/ui/ThemedButton';

type NewConnectionProps = {
  visible: boolean;
  onClose: () => void;
};

export function NewConnection({ visible, onClose }: NewConnectionProps) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const functionsInstance = getFunctions();
  const newConnectionCF = httpsCallable(functionsInstance, 'newConnection');

  // Helper to validate email format
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleConnect = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      // Call the newConnection cloud function with the provided email.
      await newConnectionCF({ email });
      // Regardless of the outcome (even if no matching user was found or a duplicate exists),
      // update the UI to show that the request was sent.
      setRequestSent(true);
    } catch (error: any) {
      console.error('Error initiating connection request:', error);
      Alert.alert('Error', error.message || 'An error occurred while sending the request.');
      onClose();
    }
  };

  // Reset view when modal is reopened
  const handleModalClose = () => {
    setEmail('');
    setRequestSent(false);
    onClose();
  };

  return (
    <ThemedModal visible={visible} onRequestClose={handleModalClose} useBlur>
      {!requestSent ? (
        <>
          <Text style={theme.modalTitle}>New Connection Request</Text>
          <TextInput
            style={theme.input}
            placeholder="Find user by email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={theme.buttonRow}>
            <ThemedButton title="Cancel" variant="secondary" onPress={handleModalClose} />
            <ThemedButton title="Connect" variant="primary" onPress={handleConnect} />
          </View>
        </>
      ) : (
        <>
          <Text style={theme.modalTitle}>Request Sent</Text>
          <Text style={theme.bodyText}>
            If a user with that email exists, your connection request has been sent.
          </Text>
          <View style={theme.buttonRow}>
            <ThemedButton title="New Connection" variant="primary" onPress={() => {
              // Reset the view for another connection attempt
              setEmail('');
              setRequestSent(false);
            }} />
            <ThemedButton title="Close" variant="secondary" onPress={handleModalClose} />
          </View>
        </>
      )}
    </ThemedModal>
  );
}
