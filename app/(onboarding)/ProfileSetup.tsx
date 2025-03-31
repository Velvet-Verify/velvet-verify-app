// app/(onboarding)/ProfileSetup.tsx
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from '@/src/context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { MembershipSelectionModal } from '@/components/membership/MembershipSelectionModal';

export default function ProfileSetup() {
  const router = useRouter();
  const { user } = useAuth();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, 'computeHashedId');

  // Two separate modals, each controlled by its own state:
  const [editModalVisible, setEditModalVisible] = useState(true);
  const [membershipModalVisible, setMembershipModalVisible] = useState(false);

  // 1) Called when user taps "Save" in the EditProfileModal
  const handleSaveProfile = async (displayName: string, photoUri: string) => {
    if (!displayName) {
      Alert.alert('Error', 'Please enter a valid display name.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'No user found. Please log in again.');
      return;
    }

    try {
      // Compute the unique profile hash
      const result = await computeHashedIdCF({ hashType: 'profile' });
      const psuuid = result.data.hashedId;

      // Attempt image upload (skip if no photoUri)
      let imageUrl = '';
      if (photoUri) {
        try {
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
          await uploadBytes(storageRef, blob);
          imageUrl = await getDownloadURL(storageRef);
        } catch (err: any) {
          console.warn('Image upload failed:', err);
          Alert.alert(
            'Image Upload Error',
            'Could not upload the profile image, continuing without it...'
          );
          // We do NOT return here, so we can still proceed to membership
        }
      }

      // Write publicProfile doc
      await setDoc(doc(db, 'publicProfile', psuuid), {
        PSUUID: psuuid,
        displayName,
        imageUrl,
        createdAt: new Date().toISOString(),
      });

      // Close the EditProfileModal
      setEditModalVisible(false);

      // Show membership selection next
      setMembershipModalVisible(true);

    } catch (error: any) {
      console.error('Error creating public profile:', error);
      Alert.alert('Error', error.message);
    }
  };

  // 2) If user cancels out of Profile Setup, we STILL want membership selection
  const handleCancelProfile = () => {
    // Close the EditProfileModal
    setEditModalVisible(false);

    // Force membership selection
    setMembershipModalVisible(true);
  };

  // 3) Once membership is chosen (or canceled) in that modal, we proceed to home
  const handleMembershipDone = () => {
    setMembershipModalVisible(false);
    router.replace('/');
  };

  return (
    <>
      {/* Step 1: show EditProfileModal for name & photo */}
      <EditProfileModal
        visible={editModalVisible}
        initialDisplayName=""
        initialPhotoUri=""
        onSave={handleSaveProfile}
        onCancel={handleCancelProfile}
        title="Profile Setup"
        showCancel={true}
      />

      {/* Step 2: membership selection shown after doc is created (or user cancels profile) */}
      <MembershipSelectionModal
        visible={membershipModalVisible}
        onClose={handleMembershipDone}
      />
    </>
  );
}
