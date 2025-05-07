// app/(onboarding)/ProfileSetup.tsx
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
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

  /* ------------------------------------------------------------------ */
  /* modal state                                                         */
  /* ------------------------------------------------------------------ */
  const [editModalVisible, setEditModalVisible] = useState(true);
  const [membershipModalVisible, setMembershipModalVisible] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Step 1 – save profile                                               */
  /* ------------------------------------------------------------------ */
  const handleSaveProfile = async (displayName: string, photoUri: string) => {
    if (!displayName) {
      Alert.alert('Error', 'Please enter a valid display name.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'No user session found. Please log in again.');
      return;
    }

    try {
      /* ---------- hashes ---------- */
      const { data: suuidData } = await computeHashedIdCF({ hashType: 'standard' });
      const suuid = suuidData.hashedId as string;

      const { data: psData } = await computeHashedIdCF({ hashType: 'profile', inputSUUID: suuid });
      const psuuid = psData.hashedId as string;

      const { data: hsData } = await computeHashedIdCF({ hashType: 'health', inputSUUID: suuid });
      const hsuuid = hsData.hashedId as string;

      /* ---------- optional avatar ---------- */
      let imageUrl = '';
      if (photoUri) {
        try {
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
          await uploadBytes(storageRef, blob);
          imageUrl = await getDownloadURL(storageRef);
        } catch (err) {
          console.warn('Image upload failed:', err);
          Alert.alert('Image Upload Error', 'Could not upload the profile image. Continuing without it.');
        }
      }

      /* ---------- write public profile ---------- */
      await setDoc(doc(db, 'publicProfile', psuuid), {
        PSUUID: psuuid,
        displayName,
        imageUrl,
        createdAt: new Date().toISOString(),
      });

      /* ---------- seed baseline healthStatus ---------- */
      const stdiSnap = await getDocs(collection(db, 'STDI'));
      const batch = writeBatch(db);
      const now = serverTimestamp();

      stdiSnap.forEach((d) => {
        batch.set(
          doc(db, 'healthStatus', `${hsuuid}_${d.id}`),
          {
            stdiId: d.id,
            healthStatus: 0,
            testDate: now,
            exposureDate: now,
            createdAt: now,
            newAlert: false
          },
          { merge: true },
        );
      });
      await batch.commit();

      /* ---------- advance flow ---------- */
      setEditModalVisible(false);
      setMembershipModalVisible(true);
    } catch (error: any) {
      console.error('Error during profile setup:', error);
      Alert.alert('Error', error.message ?? 'Unknown error');
    }
  };

  /* ------------------------------------------------------------------ */
  /* Step 2 – cancel profile → membership                                */
  /* ------------------------------------------------------------------ */
  const handleCancelProfile = () => {
    setEditModalVisible(false);
    setMembershipModalVisible(true);
  };

  /* ------------------------------------------------------------------ */
  /* Step 3 – finish onboarding                                          */
  /* ------------------------------------------------------------------ */
  const handleMembershipDone = () => {
    setMembershipModalVisible(false);
    router.replace('/');
  };

  /* ------------------------------------------------------------------ */
  /* render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <>
      <EditProfileModal
        visible={editModalVisible}
        initialDisplayName=""
        initialPhotoUri=""
        onSave={handleSaveProfile}
        onCancel={handleCancelProfile}
        title="Profile Setup"
        showCancel
      />

      <MembershipSelectionModal
        visible={membershipModalVisible}
        onClose={handleMembershipDone}
      />
    </>
  );
}
