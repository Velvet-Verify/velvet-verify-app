// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, SafeAreaView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { computePSUUIDFromSUUID, computeHSUUIDFromSUUID } from '@/src/utils/hash';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import DefaultAvatar from '@/components/DefaultAvatar';
import SubmitTestResults from '@/components/SubmitTestResults';
import { useStdis } from '@/hooks/useStdis';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { ProfileHeader } from '@/components/ui/ProfileHeader';
import { HealthStatusArea } from '@/components/ui/HealthStatusArea';
import { EditProfileModal } from '@/components/ui/EditProfileModal';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, suuid, logout } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<{ [key: string]: any } | null>(null);

  // Modal state for the combined Edit Profile modal
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  // (Keep Submit Test Results modal state if you still use it)
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);

  const { stdis, loading: stdisLoading } = useStdis();

  // Load public profile on mount
  useEffect(() => {
    async function loadProfile() {
      if (user && suuid) {
        const psuuid = await computePSUUIDFromSUUID(suuid);
        const profileDocRef = doc(db, 'publicProfile', psuuid);
        const docSnap = await getDoc(profileDocRef);
        if (!docSnap.exists()) {
          router.replace('/ProfileSetup');
        } else {
          setProfileData(docSnap.data());
          setLoading(false);
        }
      }
    }
    loadProfile();
  }, [user, suuid, db, router]);

  // Refresh health statuses for each STDI
  const refreshHealthStatuses = async () => {
    if (user && suuid && stdis && stdis.length > 0) {
      const hsUUID = await computeHSUUIDFromSUUID(suuid);
      const hsData: { [key: string]: any } = {};
      await Promise.all(
        stdis.map(async (stdi) => {
          const hsDocId = `${hsUUID}_${stdi.id}`;
          const hsDocRef = doc(db, 'healthStatus', hsDocId);
          const hsDocSnap = await getDoc(hsDocRef);
          if (hsDocSnap.exists()) {
            hsData[stdi.id] = hsDocSnap.data();
          }
        })
      );
      setHealthStatuses(hsData);
    }
  };

  useEffect(() => {
    refreshHealthStatuses();
  }, [user, suuid, stdis, db]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Combined update profile function for EditProfileModal
  const handleUpdateProfile = async (updatedDisplayName: string, updatedPhotoUri: string) => {
    try {
      const psuuid = await computePSUUIDFromSUUID(suuid!);
      const profileDocRef = doc(db, 'publicProfile', psuuid);
      let finalPhotoUrl = updatedPhotoUri;

      // If the photo has changed and is non-empty, update storage
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
      setProfileData({ ...profileData, displayName: updatedDisplayName, imageUrl: finalPhotoUrl });
      setEditProfileModalVisible(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message);
    }
  };

  // Functions for editing profile photo (pass-through to the modal)
  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Gallery permission is needed!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      // For the modal, you may choose to update its local state.
      // Here we simply pass the action to the modal via callbacks.
      // (You might lift the photo state if needed.)
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is needed!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Same as above.
    }
  };

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
      {/* Profile Header with combined "Edit Profile" and "Submit Test Result" links */}
      <ProfileHeader
        displayName={profileData?.displayName}
        imageUrl={profileData?.imageUrl}
        onEditProfile={() => setEditProfileModalVisible(true)}
        onSubmitTest={() => setSubmitTestModalVisible(true)}
      />

      {/* Health Status Area */}
      <View style={{ paddingLeft: 20, paddingTop: 20, alignItems: 'center', flex: 1, paddingBottom: insets.bottom + 75 }}>
        <Text style={theme.title}>Health Status</Text>
        <HealthStatusArea stdis={stdis} statuses={healthStatuses} />
      </View>

      {/* Logout Button positioned at top right */}
      <View style={{ position: 'absolute', top: insets.top + 10, right: 10 }}>
        <Button title="Logout" color={theme.buttonPrimary.backgroundColor} onPress={handleLogout} />
      </View>

      {/* Combined Edit Profile Modal */}
      <EditProfileModal
        visible={editProfileModalVisible}
        initialDisplayName={profileData?.displayName}
        initialPhotoUri={profileData?.imageUrl}
        onPickImage={pickImageFromGallery}
        onTakePhoto={takePhoto}
        onRemovePhoto={() => {}}
        onCancel={() => setEditProfileModalVisible(false)}
        onSave={handleUpdateProfile}
      />

      {/* Submit Test Results Modal */}
      <ThemedModal visible={submitTestModalVisible} useBlur onRequestClose={() => setSubmitTestModalVisible(false)}>
        <SubmitTestResults onClose={() => {
          setSubmitTestModalVisible(false);
          refreshHealthStatuses();
        }} />
      </ThemedModal>
    </SafeAreaView>
  );
}
