// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  Text,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import { firebaseApp } from '@/src/firebase/config';
import * as ImagePicker from 'expo-image-picker';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import SubmitTestResults from '@/components/health/SubmitTestResults';
import { useStdis } from '@/hooks/useStdis';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { HealthStatusArea } from '@/components/health/HealthStatusArea';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const storage = getStorage(firebaseApp);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<{ [key: string]: any } | null>(null);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);
  const { stdis, loading: stdisLoading } = useStdis();

  // Initialize Firebase Functions
  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, 'computeHashedId');
  const getPublicProfileCF = httpsCallable(functionsInstance, 'getPublicProfile');
  const getUserHealthStatusesCF = httpsCallable(functionsInstance, 'getUserHealthStatuses');

  /**
   * Load the public profile once when the user changes to a logged-in user.
   */
  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        // If user is null, we can reset or do nothing
        setProfileData(null);
        setLoading(false);
        return;
      }
      try {
        // Retrieve public profile data via CF
        const result = await getPublicProfileCF({});
        const profile = result.data;
        setProfileData(profile);
      } catch (error: any) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', error.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user, getPublicProfileCF]);

  /**
   * Refresh health statuses if the user is logged in and we have STDI data loaded.
   */
  const refreshHealthStatuses = async () => {
    if (!user) return; // skip if no user
    if (!stdis || stdis.length === 0) return; // skip if no STDI
    try {
      // We do NOT call user.getIdToken(true). Firestore Functions
      // automatically attach the current token.
      const result = await getUserHealthStatusesCF({});
      const data = result.data as any;
      setHealthStatuses(data?.statuses || {});
    } catch (error: any) {
      console.error('Error refreshing health statuses:', error);
    }
  };

  /**
   * Only refresh if user changes from null -> logged in
   * or if the STDI array changes from empty -> loaded.
   */
  useEffect(() => {
    if (user && stdis.length > 0) {
      refreshHealthStatuses();
    }
    // We do not add getUserHealthStatusesCF as a dependency
    // so this won't re-run every function reference change.
  }, [user, stdis]);

  /**
   * Logout logic
   */
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Combined update profile function for EditProfileModal
   */
  const handleUpdateProfile = async (updatedDisplayName: string, updatedPhotoUri: string) => {
    try {
      if (!user) throw new Error('User is not logged in.');

      // Just get a token if you like. Usually not needed:
      // await user.getIdToken(/* forceRefresh = false */);
      const result = await computeHashedIdCF({ hashType: 'profile' });
      const psuuid = result.data.hashedId;

      const { getFirestore, doc, updateDoc } = await import('firebase/firestore');
      const db = getFirestore(firebaseApp);

      const profileDocRef = doc(db, 'publicProfile', psuuid);
      let finalPhotoUrl = updatedPhotoUri;

      if (updatedPhotoUri !== profileData?.imageUrl) {
        if (updatedPhotoUri) {
          if (profileData?.imageUrl) {
            try {
              const oldRef = ref(storage, `profileImages/${psuuid}.jpg`);
              await deleteObject(oldRef);
            } catch (error) {
              console.error('Error deleting old image:', error);
            }
          }
          const response = await fetch(updatedPhotoUri);
          const blob = await response.blob();
          const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
          await uploadBytes(storageRef, blob);
          finalPhotoUrl = await getDownloadURL(storageRef);
        } else {
          finalPhotoUrl = '';
        }
      }

      await updateDoc(profileDocRef, {
        displayName: updatedDisplayName,
        imageUrl: finalPhotoUrl,
      });
      setProfileData({
        ...profileData,
        displayName: updatedDisplayName,
        imageUrl: finalPhotoUrl,
      });
      setEditProfileModalVisible(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message);
    }
  };

  /**
   * Optional pickImageFromGallery / takePhoto logic
   * omitted for brevity...
   */

  if (loading) {
    return (
      <SafeAreaView style={theme.container}>
        <View style={{ justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" color={theme.buttonPrimary.backgroundColor} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={theme.container}>
      {/* Profile Header */}
      <ProfileHeader
        displayName={profileData?.displayName}
        imageUrl={profileData?.imageUrl}
        onEditProfile={() => setEditProfileModalVisible(true)}
        onSubmitTest={() => setSubmitTestModalVisible(true)}
        onLogout={handleLogout}
      />

      {/* Health Status Area */}
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
        initialDisplayName={profileData?.displayName}
        initialPhotoUri={profileData?.imageUrl}
        onPickImage={() => {}}
        onTakePhoto={() => {}}
        onRemovePhoto={() => {}}
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
            refreshHealthStatuses();
          }}
        />
      </ThemedModal>
    </SafeAreaView>
  );
}
