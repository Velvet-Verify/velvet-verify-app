// app/(onboarding)/ProfileSetup.tsx
import React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import { computeHashedId } from '@/src/utils/hash'; // Updated import
import { useTheme } from 'styled-components/native';
import { EditProfileModal } from '@/components/ui/EditProfileModal';

export default function ProfileSetup() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  // onSave callback creates a new public profile record.
  const handleSave = async (displayName: string, photoUri: string) => {
    if (!displayName) {
      Alert.alert('Error', 'Please enter a valid display name.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'User not found or not initialized. Please log in again.');
      return;
    }
    try {
      // Compute the module-specific (public profile) hash.
      const psuuid = await computeHashedId('profile');
      // console.log("Computed PSUUID:", psuuid); // Log to validate the computed value
      let imageUrl = '';
      if (photoUri) {
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }
      await setDoc(doc(db, 'publicProfile', psuuid), {
        PSUUID: psuuid,
        displayName: displayName,
        imageUrl, // empty string if no image
        createdAt: new Date().toISOString(),
      });
      router.replace('/');
    } catch (error: any) {
      console.error('Error creating public profile:', error);
      Alert.alert('Error', error.message);
    }
  };

  // onCancel for setup can simply route back.
  const handleCancel = () => {
    router.back();
  };

  return (
    <EditProfileModal
      visible={true}
      initialDisplayName=""
      initialPhotoUri=""
      onSave={handleSave}
      onCancel={handleCancel}
      title="Profile Setup"
      showCancel={false} // No cancel button on profile setup
    />
  );
}
