// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, ScrollView, Button, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ThemedButton } from '@/components/ui/ThemedButton';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, suuid, logout } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<any[]>([]);

  // Modal states
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [editPhotoModalVisible, setEditPhotoModalVisible] = useState(false);
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhotoUri, setNewPhotoUri] = useState<string>('');

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

  // Function to refresh health statuses for each STDI
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
      // Convert object to array for HealthStatusArea
      const statuses = Object.keys(hsData).map(key => ({ id: key, ...hsData[key] }));
      setHealthStatuses(statuses);
    }
  };

  // Load health statuses when STDIs change
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

  // Update display name
  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }
    try {
      const psuuid = await computePSUUIDFromSUUID(suuid!);
      const profileDocRef = doc(db, 'publicProfile', psuuid);
      await updateDoc(profileDocRef, { displayName: newDisplayName.trim() });
      setProfileData({ ...profileData, displayName: newDisplayName.trim() });
      setEditNameModalVisible(false);
    } catch (error: any) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', error.message);
    }
  };

  // Functions for editing profile photo
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
      setNewPhotoUri(result.assets[0].uri);
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
      setNewPhotoUri(result.assets[0].uri);
    }
  };

  const removePhoto = () => {
    setNewPhotoUri('');
  };

  const uriToBlob = async (uri: string): Promise<Blob> => {
    const response = await fetch(uri);
    return await response.blob();
  };

  const handleUpdatePhoto = async () => {
    try {
      const psuuid = await computePSUUIDFromSUUID(suuid!);
      const profileDocRef = doc(db, 'publicProfile', psuuid);
      let updatedImageUrl = profileData?.imageUrl || '';
      if (newPhotoUri) {
        if (profileData?.imageUrl) {
          try {
            const oldRef = ref(storage, `profileImages/${psuuid}.jpg`);
            await deleteObject(oldRef);
          } catch (error) {
            console.error('Error deleting old image:', error);
          }
        }
        const blob = await uriToBlob(newPhotoUri);
        const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
        await uploadBytes(storageRef, blob);
        updatedImageUrl = await getDownloadURL(storageRef);
      } else {
        updatedImageUrl = '';
      }
      await updateDoc(profileDocRef, { imageUrl: updatedImageUrl });
      setProfileData({ ...profileData, imageUrl: updatedImageUrl });
      setEditPhotoModalVisible(false);
    } catch (error: any) {
      console.error('Error updating photo:', error);
      Alert.alert('Error', error.message);
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
      {/* Profile Header */}
      <ProfileHeader
        displayName={profileData?.displayName}
        imageUrl={profileData?.imageUrl}
        onEditName={() => {
          setNewDisplayName(profileData?.displayName);
          setEditNameModalVisible(true);
        }}
        onEditPhoto={() => {
          setNewPhotoUri(profileData?.imageUrl || '');
          setEditPhotoModalVisible(true);
        }}
      />

      {/* Submit Test Results Button */}
      <View style={{ marginVertical: 10, alignSelf: 'center' }}>
        <Button
          title="Submit Test Results"
          color={theme.buttonPrimary.backgroundColor}
          onPress={() => setSubmitTestModalVisible(true)}
        />
      </View>

      {/* Health Status Area */}
      <View style={{ padding: 20, alignItems: 'center', flex: 1 }}>
        <Text style={theme.title}>Health Status</Text>
        <HealthStatusArea statuses={healthStatuses} />
      </View>

      {/* Logout Button positioned at top right */}
      <View style={{ position: 'absolute', top: insets.top + 10, right: 10 }}>
        <Button
          title="Logout"
          color={theme.buttonPrimary.backgroundColor}
          onPress={handleLogout}
        />
      </View>

      {/* Modals */}
      <ThemedModal visible={editNameModalVisible} onRequestClose={() => setEditNameModalVisible(false)}>
        <Text style={theme.modalTitle}>Edit Display Name</Text>
        <TextInput
          style={theme.input}
          value={newDisplayName}
          onChangeText={setNewDisplayName}
          placeholder="Enter new display name"
        />
        <View style={theme.buttonRow}>
          <ThemedButton title="Cancel" variant="secondary" onPress={() => setEditNameModalVisible(false)} />
          <ThemedButton title="Save" onPress={handleUpdateDisplayName} />
        </View>
      </ThemedModal>

      <ThemedModal visible={editPhotoModalVisible} onRequestClose={() => setEditPhotoModalVisible(false)}>
        <Text style={theme.modalTitle}>Edit Profile Photo</Text>
        {newPhotoUri ? (
          <Image source={{ uri: newPhotoUri }} style={theme.previewImage} />
        ) : (
          <DefaultAvatar size={150} />
        )}
        <View style={theme.buttonRow}>
          <ThemedButton title="Gallery" variant="primary" onPress={pickImageFromGallery} />
          <ThemedButton title="Camera" variant="primary" onPress={takePhoto} />
          <ThemedButton title="Remove" variant="primary" onPress={removePhoto} />
        </View>
        <View style={theme.buttonRow}>
          <ThemedButton title="Cancel" variant="secondary" onPress={() => setEditPhotoModalVisible(false)} />
          <ThemedButton title="Save" onPress={handleUpdatePhoto} />
        </View>
      </ThemedModal>

      <ThemedModal visible={submitTestModalVisible} useBlur onRequestClose={() => setSubmitTestModalVisible(false)}>
        <SubmitTestResults onClose={() => {
          setSubmitTestModalVisible(false);
          refreshHealthStatuses();
        }} />
      </ThemedModal>
    </SafeAreaView>
  );
}
