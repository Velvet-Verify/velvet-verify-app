// app/(tabs)/index.tsx
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  SafeAreaView,
  Text,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useRouter } from "expo-router";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { firebaseApp } from "@/src/firebase/config";
import * as ImagePicker from "expo-image-picker";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import SubmitTestResults from "@/components/health/SubmitTestResults";
import { useStdis } from "@/hooks/useStdis";
import { useTheme } from "styled-components/native";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { HealthStatusArea } from "@/components/health/HealthStatusArea";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<{ [key: string]: any } | null>(null);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);
  const { stdis, loading: stdisLoading } = useStdis();

  // Initialize Firebase Functions with your FirebaseApp.
  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, "computeHashedId");
  const getPublicProfileCF = httpsCallable(functionsInstance, "getPublicProfile");

  // Load public profile on mount.
  useEffect(() => {
    async function loadProfile() {
      if (user) {
        try {
          // Call the cloud function to retrieve the public profile data.
          const result = await getPublicProfileCF({});
          const profile = result.data;
          // We now directly use the public profile data returned by the cloud function.
          setProfileData(profile);
          setLoading(false);
        } catch (error: any) {
          console.error("Error loading profile:", error);
          Alert.alert("Error", error.message);
        }
      }
    }
    loadProfile();
  }, [user, router]);

  // Refresh health statuses for each STDI.
  const refreshHealthStatuses = async () => {
    if (user && stdis && stdis.length > 0) {
      try {
        await user.getIdToken(true);
        const result = await computeHashedIdCF({ hashType: "health" });
        const hsUUID = result.data.hashedId;
        const hsData: { [key: string]: any } = {};
        await Promise.all(
          stdis.map(async (stdi) => {
            const hsDocId = `${hsUUID}_${stdi.id}`;
            const hsDocRef = doc(db, "healthStatus", hsDocId);
            const hsDocSnap = await getDoc(hsDocRef);
            if (hsDocSnap.exists()) {
              hsData[stdi.id] = hsDocSnap.data();
            }
          })
        );
        setHealthStatuses(hsData);
      } catch (error: any) {
        console.error("Error refreshing health statuses:", error);
      }
    }
  };

  useEffect(() => {
    refreshHealthStatuses();
  }, [user, stdis, db]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/Login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Combined update profile function for EditProfileModal.
  const handleUpdateProfile = async (
    updatedDisplayName: string,
    updatedPhotoUri: string
  ) => {
    try {
      await user.getIdToken(true);
      const result = await computeHashedIdCF({ hashType: "profile" });
      const psuuid = result.data.hashedId;
      const profileDocRef = doc(db, "publicProfile", psuuid);
      let finalPhotoUrl = updatedPhotoUri;

      if (updatedPhotoUri !== profileData?.imageUrl) {
        if (updatedPhotoUri) {
          if (profileData?.imageUrl) {
            try {
              const oldRef = ref(storage, `profileImages/${psuuid}.jpg`);
              await deleteObject(oldRef);
            } catch (error) {
              console.error("Error deleting old image:", error);
            }
          }
          const response = await fetch(updatedPhotoUri);
          const blob = await response.blob();
          const storageRef = ref(storage, `profileImages/${psuuid}.jpg`);
          await uploadBytes(storageRef, blob);
          finalPhotoUrl = await getDownloadURL(storageRef);
        } else {
          finalPhotoUrl = "";
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
      console.error("Error updating profile:", error);
      Alert.alert("Error", error.message);
    }
  };

  // Functions for editing profile photo.
  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Gallery permission is needed!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Update local state for photo as needed.
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is needed!");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Update local state for photo as needed.
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={theme.container}>
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <ActivityIndicator
            size="large"
            color={theme.buttonPrimary.backgroundColor}
          />
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
      />

      {/* Health Status Area */}
      <View
        style={{
          paddingLeft: 20,
          paddingTop: 20,
          alignItems: "center",
          flex: 1,
          paddingBottom: insets.bottom + 75,
        }}
      >
        <Text style={theme.title}>Health Status</Text>
        <HealthStatusArea stdis={stdis} statuses={healthStatuses} />
      </View>

      {/* Logout Button */}
      <View style={{ position: "absolute", top: insets.top + 10, right: 10 }}>
        <Button
          title="Logout"
          color={theme.buttonPrimary.backgroundColor}
          onPress={handleLogout}
        />
      </View>

      {/* Edit Profile Modal */}
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
