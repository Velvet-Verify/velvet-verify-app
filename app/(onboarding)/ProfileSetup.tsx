// app/(onboarding)/ProfileSetup.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import { computePSUUIDFromSUUID } from '@/src/utils/hash';

export default function ProfileSetup() {
  const [displayName, setDisplayName] = useState('');
  const router = useRouter();
  const { user, suuid } = useAuth();
  const db = getFirestore(firebaseApp);

  const handleProfileSetup = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name.');
      return;
    }
    if (!user || !suuid) {
      Alert.alert('Error', 'User not found or not initialized. Please log in again.');
      return;
    }
    try {
      // Compute PSUUID from the cached SUUID.
      const psuuid = await computePSUUIDFromSUUID(suuid);
      await setDoc(doc(db, 'publicProfile', psuuid), {
        PSUUID: psuuid,
        displayName: displayName.trim(),
        createdAt: new Date().toISOString(),
      });
      router.replace('/');
    } catch (error: any) {
      console.error('Error creating public profile:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Your Public Profile</Text>
      <TextInput
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <Button title="Create Profile" onPress={handleProfileSetup} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginBottom: 20,
    borderRadius: 5,
  },
});
