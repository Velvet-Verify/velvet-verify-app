// app/(tabs)/index.tsx

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from 'styled-components/native';

import { useAuth } from '@/src/context/AuthContext';
import { firebaseApp } from '@/src/firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { useStdis } from '@/hooks/useStdis';

import SubmitTestResults from '@/components/health/SubmitTestResults';
import { HealthStatusArea } from '@/components/health/HealthStatusArea';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { ThemedModal } from '@/components/ui/ThemedModal';

/**
 * HomeScreen with advanced UI:
 * - If no user => route /Login
 * - If no public profile => route /ProfileSetup
 * - Else show profile header, health status, ability to edit profile, submit test results, etc.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const storage = getStorage(firebaseApp);

  // Local state
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<{ [key: string]: any } | null>(null);

  // UI modals
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);

  // STDI loading
  const { stdis, loading: stdisLoading } = useStdis();

  // Functions
  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, 'computeHashedId');
  const getPublicProfileCF = httpsCallable(functionsInstance, 'getPublicProfile');
  const getUserHealthStatusesCF = httpsCallable(functionsInstance, 'getUserHealthStatuses');

  /**
   * Main effect: if user is not logged in => /Login.
   * Otherwise fetch the public profile doc. If none => /ProfileSetup.
   */
  useEffect(() => {
    if (!user) {
      // not logged in => just route to /Login
      router.replace('/Login');
      return;
    }

    async function loadProfile() {
      try {
        const result = await getPublicProfileCF({});
        setProfileData(result.data); // We have a valid profile
      } catch (error: any) {
        // If doc not found => user must set up
        if (
          error.message?.includes('not-found') ||
          error?.code === 'functions/not-found'
        ) {
          router.replace('/(onboarding)/ProfileSetup');
          return;
        } else {
          Alert.alert('Profile Error', error.message || 'Error loading profile');
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  /**
   * Called whenever user or STDI data becomes available to fetch health statuses.
   */
  useEffect(() => {
    if (user && stdis.length > 0) {
      refreshHealthStatuses();
    }
  }, [user, stdis]);

  // Helper to load remote user’s health statuses
  const refreshHealthStatuses = async () => {
    if (!user) return;
    if (!stdis || stdis.length === 0) return;

    try {
      const result = await getUserHealthStatusesCF({});
      const data = result.data as any;
      setHealthStatuses(data?.statuses || {});
    } catch (error: any) {
      console.error('Error refreshing health statuses:', error);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Called when saving changes in EditProfileModal
   */
  const handleUpdateProfile = async (
    updatedDisplayName: string,
    updatedPhotoUri: string
  ) => {
    if (!user) {
      Alert.alert('Error', 'User is not logged in.');
      return;
    }

    try {
      // 1) Compute the doc ID => psuuid
      const result = await computeHashedIdCF({ hashType: 'profile' });
      const psuuid = result.data.hashedId;

      // 2) If the photo changed, delete old, upload new
      let finalPhotoUrl = updatedPhotoUri;
      if (updatedPhotoUri !== profileData?.imageUrl) {
        // Remove old image if it exists
        if (profileData?.imageUrl) {
          try {
            const oldRef = ref(storage, `profileImages/${psuuid}.jpg`);
            await deleteObject(oldRef);
          } catch (delError) {
            console.error('Error deleting old image:', delError);
          }
        }
        if (updatedPhotoUri) {
          const response = await fetch(updatedPhotoUri);
          const blob = await response.blob();
          const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
          await uploadBytes(storageRef, blob);
          finalPhotoUrl = await getDownloadURL(storageRef);
        } else {
          finalPhotoUrl = '';
        }
      }

      // 3) Update the publicProfile doc
      const db = getFirestore(firebaseApp);
      const docRef = doc(db, 'publicProfile', psuuid);
      await updateDoc(docRef, {
        displayName: updatedDisplayName,
        imageUrl: finalPhotoUrl,
      });

      // 4) Update local state
      setProfileData({
        ...profileData,
        displayName: updatedDisplayName,
        imageUrl: finalPhotoUrl,
      });

      // 5) close modal
      setEditProfileModalVisible(false);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      Alert.alert('Error', err.message);
    }
  };

  // If still loading, show spinner
  if (loading) {
    return (
      <SafeAreaView style={theme.container}>
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <ActivityIndicator
            color={theme.buttonPrimary.backgroundColor}
            size="large"
          />
        </View>
      </SafeAreaView>
    );
  }

  // If we get here, we presumably have a valid user + valid public profile
  return (
    <SafeAreaView style={theme.container}>
      {/* Profile Header */}
      <ProfileHeader
        displayName={profileData?.displayName || 'Unnamed User'}
        imageUrl={profileData?.imageUrl || ''}
        onEditProfile={() => setEditProfileModalVisible(true)}
        onSubmitTest={() => setSubmitTestModalVisible(true)}
        onLogout={handleLogout}
      />

      {/* Show their health status info */}
      <View
        style={{
          paddingLeft: 20,
          paddingTop: 20,
          alignItems: 'center',
          flex: 1,
          paddingBottom: insets.bottom + 75,
        }}
      >
        <Text style={theme.title}>Health Status</Text>
        <HealthStatusArea stdis={stdis} statuses={healthStatuses} />
      </View>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={editProfileModalVisible}
        initialDisplayName={profileData?.displayName || ''}
        initialPhotoUri={profileData?.imageUrl || ''}
        onPickImage={() => {
          // optional: implement pick logic or pass down
        }}
        onTakePhoto={() => {
          // optional: implement camera logic
        }}
        onRemovePhoto={() => {
          // optional: implement remove logic
        }}
        onCancel={() => setEditProfileModalVisible(false)}
        onSave={handleUpdateProfile}
      />

      {/* Submit Test Results Modal */}
      <ThemedModal
        visible={submitTestModalVisible}
        useBlur
        onRequestClose={() => setSubmitTestModalVisible(false)}
      >
        <SubmitTestResults
          onClose={() => {
            setSubmitTestModalVisible(false);
            refreshHealthStatuses(); // refresh once they submit new results
          }}
        />
      </ThemedModal>
    </SafeAreaView>
  );
}
