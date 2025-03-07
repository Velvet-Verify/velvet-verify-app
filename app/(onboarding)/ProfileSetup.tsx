// app/(onboarding)/ProfileSetup.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import { computePSUUIDFromSUUID } from '@/src/utils/hash';
import { useTheme } from 'styled-components/native';

export default function ProfileSetup() {
  const theme = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [imageUri, setImageUri] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const { user, suuid } = useAuth();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  // Function to pick image from the gallery using new API format
  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access gallery is needed!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Function to take a photo using the camera using new API format
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access camera is needed!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Helper function to convert image URI to blob
  const uriToBlob = async (uri: string): Promise<Blob> => {
    const response = await fetch(uri);
    return await response.blob();
  };

  const handleProfileSetup = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name.');
      return;
    }
    if (!user || !suuid) {
      Alert.alert('Error', 'User not found or not initialized. Please log in again.');
      return;
    }
    setUploading(true);
    try {
      // Compute PSUUID from the cached SUUID.
      const psuuid = await computePSUUIDFromSUUID(suuid);
      let imageUrl = '';

      // If an image is selected, upload it to Firebase Storage.
      if (imageUri) {
        const blob = await uriToBlob(imageUri);
        const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      // Save the public profile document to Firestore.
      await setDoc(doc(db, 'publicProfile', psuuid), {
        PSUUID: psuuid,
        displayName: displayName.trim(),
        imageUrl, // will be empty string if no image was uploaded
        createdAt: new Date().toISOString(),
      });
      router.replace('/');
    } catch (error: any) {
      console.error('Error creating public profile:', error);
      Alert.alert('Error', error.message);
    }
    setUploading(false);
  };

  return (
    <View style={[styles.container, theme.container]}>
      <Text style={[styles.title, theme.title]}>Set Up Your Public Profile</Text>
      <TextInput
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <View style={styles.buttonRow}>
        <Button
          title="Choose from Gallery"
          onPress={pickImageFromGallery}
          color={theme.buttonPrimary.backgroundColor}
        />
        <Button
          title="Take Photo"
          onPress={takePhoto}
          color={theme.buttonPrimary.backgroundColor}
        />
      </View>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.previewImage} />
      ) : (
        <Text style={styles.previewText}>No profile picture selected</Text>
      )}
      <Button
        title={uploading ? 'Uploading...' : 'Create Profile'}
        onPress={handleProfileSetup}
        disabled={uploading}
        color={theme.buttonPrimary.backgroundColor}
      />
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
    borderColor: '#ccc', // Consider updating this with a theme value later.
    padding: 12,
    marginBottom: 20,
    borderRadius: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  previewImage: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 75,
  },
  previewText: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#888',
  },
});
