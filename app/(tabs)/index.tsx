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
  ScrollView,
} from 'react-native';
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
import { BlurView } from 'expo-blur';
import { useStdis } from '@/hooks/useStdis';
import { useTheme } from 'styled-components/native';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, suuid, logout } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<{ [key: string]: any }>({});

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
      setHealthStatuses(hsData);
    }
  };

  // Load healthStatus for each STDI when STDIs change
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.buttonPrimary.backgroundColor} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={theme.container}>
      {/* Fixed Header */}
      <View style={styles.headerContainer}>
        <View style={styles.profileInfo}>
          <View style={styles.nameContainer}>
            <Text style={[styles.displayName, theme.title]}>
              {profileData?.displayName}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setNewDisplayName(profileData?.displayName);
                setEditNameModalVisible(true);
              }}>
              <Text style={[styles.editText, { color: theme.buttonSecondary.backgroundColor }]}>
                Edit
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.imageContainer}>
            {profileData?.imageUrl ? (
              <Image
                source={{ uri: profileData.imageUrl }}
                style={styles.profileImage}
              />
            ) : (
              <DefaultAvatar size={150} />
            )}
            <TouchableOpacity
              onPress={() => {
                setNewPhotoUri(profileData?.imageUrl || '');
                setEditPhotoModalVisible(true);
              }}>
              <Text style={[styles.editText, { color: theme.buttonSecondary.backgroundColor }]}>
                Edit Photo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.submitTestButtonFixed}>
          <Button
            title="Submit Test Results"
            color={theme.buttonPrimary.backgroundColor}
            onPress={() => setSubmitTestModalVisible(true)}
          />
        </View>
      </View>

      {/* Scrollable Health Status Area */}
      <ScrollView contentContainerStyle={styles.healthStatusScroll}>
        <View style={styles.healthStatusContainer}>
          <Text style={[styles.healthStatusTitle, theme.title]}>
            Health Status
          </Text>
          {stdis.map((stdi) => {
            const hsData = healthStatuses[stdi.id];
            const testResultText =
              hsData && typeof hsData.testResult === 'boolean'
                ? hsData.testResult
                  ? 'Positive'
                  : 'Negative'
                : 'Not Tested';
            const testDateText =
              hsData && hsData.testDate
                ? new Date(hsData.testDate.seconds * 1000).toLocaleDateString()
                : 'N/A';
            const exposureStatusText =
              hsData && typeof hsData.exposureStatus === 'boolean'
                ? hsData.exposureStatus
                  ? 'Exposed'
                  : 'Not Exposed'
                : 'Not Exposed';
            const exposureDateText =
              hsData && hsData.exposureDate
                ? new Date(hsData.exposureDate.seconds * 1000).toLocaleDateString()
                : 'N/A';
            return (
              <View key={stdi.id} style={styles.healthStatusRow}>
                <Text style={styles.healthStatusStd}>{stdi.id}</Text>
                <Text style={styles.healthStatusText}>
                  Result: {testResultText}
                </Text>
                <Text style={styles.healthStatusText}>
                  Test Date: {testDateText}
                </Text>
                <Text style={styles.healthStatusText}>
                  Exposure: {exposureStatusText}
                </Text>
                <Text style={styles.healthStatusText}>
                  Exposure Date: {exposureDateText}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Logout Button in Top Right */}
      <View
        style={[
          styles.logoutButtonContainer,
          { top: insets.top + 10, right: 10, position: 'absolute' },
        ]}>
        <Button
          title="Logout"
          color={theme.buttonPrimary.backgroundColor}
          onPress={handleLogout}
        />
      </View>

      {/* Modals */}
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

      <Modal visible={editPhotoModalVisible} transparent animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Profile Photo</Text>
            {newPhotoUri ? (
              <Image
                source={{ uri: newPhotoUri }}
                style={styles.modalPreviewImage}
              />
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

      <Modal visible={submitTestModalVisible} transparent animationType="slide">
        <BlurView intensity={50} style={styles.modalBackground}>
          <SubmitTestResults
            onClose={() => {
              setSubmitTestModalVisible(false);
              refreshHealthStatuses(); // Refresh health statuses after submitting.
            }}
          />
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    // Removed hardcoded background in favor of global theme (theme.container supplies it)
    flex: 1,
  },
  headerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 10,
    // Optionally remove backgroundColor if your theme provides one
    backgroundColor: '#fff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  displayName: {
    fontSize: 24,
    marginRight: 10,
  },
  editText: {
    fontSize: 16,
    // Color set inline using theme.buttonSecondary.backgroundColor
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 10,
  },
  submitTestButtonFixed: {
    marginVertical: 10,
    alignSelf: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  healthStatusScroll: {
    padding: 20,
    alignItems: 'center',
  },
  healthStatusContainer: {
    width: '100%',
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  healthStatusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  healthStatusRow: {
    marginVertical: 5,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  healthStatusStd: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  healthStatusText: {
    fontSize: 14,
    color: '#555',
  },
  logoutButtonContainer: {
    // Positioned via inline style.
  },
  modalBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
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
