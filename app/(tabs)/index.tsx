// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Button,
  Image,
  Modal,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { computePSUUIDFromSUUID } from '@/src/utils/hash';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import DefaultAvatar from '@/components/DefaultAvatar';
import SubmitTestResults from '@/components/SubmitTestResults';
import { BlurView } from 'expo-blur';

export default function HomeScreen() {
  const { user, suuid, logout } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);

  // States for modals:
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [editPhotoModalVisible, setEditPhotoModalVisible] = useState(false);
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhotoUri, setNewPhotoUri] = useState<string>('');

  // Load public profile from Firestore on mount:
  useEffect(() => {
    async function loadProfile() {
      if (user && suuid) {
        const psuuid = await computePSUUIDFromSUUID(suuid);
        const profileDocRef = doc(db, 'publicProfile', psuuid);
        const docSnap = await getDoc(profileDocRef);
        if (!docSnap.exists()) {
          // If no profile exists, redirect to ProfileSetup.
          router.replace('/ProfileSetup');
        } else {
          setProfileData(docSnap.data());
          setLoading(false);
        }
      }
    }
    loadProfile();
  }, [user, suuid, db, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Update display name in Firestore:
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

  // Functions for editing profile photo:
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
        // If there's an existing image, delete it.
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
        // If newPhotoUri is empty, we remove the image.
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Display Name Section */}
        <View style={styles.nameContainer}>
          <Text style={styles.displayName}>{profileData?.displayName}</Text>
          <TouchableOpacity onPress={() => {
            setNewDisplayName(profileData?.displayName);
            setEditNameModalVisible(true);
          }}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>
        {/* Profile Image Section */}
        <View style={styles.imageContainer}>
          {profileData?.imageUrl ? (
            <Image source={{ uri: profileData.imageUrl }} style={styles.profileImage} />
          ) : (
            <DefaultAvatar size={150} />
          )}
          <TouchableOpacity onPress={() => {
            setNewPhotoUri(profileData?.imageUrl || '');
            setEditPhotoModalVisible(true);
          }}>
            <Text style={styles.editText}>Edit Photo</Text>
          </TouchableOpacity>
        </View>
        {/* Submit Test Results Button */}
        <View style={styles.submitTestButtonContainer}>
          <Button
            title="Submit Test Results"
            onPress={() => setSubmitTestModalVisible(true)}
          />
        </View>
        {/* Logout Button */}
        <View style={[styles.logoutButtonContainer, { bottom: insets.bottom + 20 }]}>
          <Button title="Logout" onPress={handleLogout} />
        </View>
      </View>

      {/* Modal for editing display name */}
      <Modal visible={editNameModalVisible} transparent animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              placeholder="Enter new display name"
            />
            <View style={styles.modalButtonRow}>
              <Button title="Cancel" onPress={() => setEditNameModalVisible(false)} />
              <Button title="Save" onPress={handleUpdateDisplayName} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for editing photo */}
      <Modal visible={editPhotoModalVisible} transparent animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Profile Photo</Text>
            {newPhotoUri ? (
              <Image source={{ uri: newPhotoUri }} style={styles.modalPreviewImage} />
            ) : (
              <DefaultAvatar size={150} />
            )}
            <View style={styles.modalButtonRow}>
              <Button title="Gallery" onPress={pickImageFromGallery} />
              <Button title="Camera" onPress={takePhoto} />
              <Button title="Remove" onPress={removePhoto} />
            </View>
            <View style={styles.modalButtonRow}>
              <Button title="Cancel" onPress={() => setEditPhotoModalVisible(false)} />
              <Button title="Save" onPress={handleUpdatePhoto} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for submitting test results */}
      <Modal visible={submitTestModalVisible} transparent animationType="slide">
        <BlurView intensity={50} style={styles.modalBackground}>
          <View style={styles.modalBackground}>
            <SubmitTestResults onClose={() => setSubmitTestModalVisible(false)} />
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  displayName: {
    fontSize: 24,
    marginRight: 10,
  },
  editText: {
    fontSize: 16,
    color: '#007AFF',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 10,
  },
  submitTestButtonContainer: {
    marginVertical: 20,
  },
  logoutButtonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  modalBackground: {
    flex: 1,
    width: "100%",
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  modalPreviewImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignSelf: 'center',
    marginBottom: 20,
  },
});
