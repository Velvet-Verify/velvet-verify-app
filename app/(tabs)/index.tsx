// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  View,
  Alert,
  ScrollView,
  Platform,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from 'styled-components/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

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
import { ThemedButton } from '@/components/ui/ThemedButton';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const storage = getStorage(firebaseApp);

  /* ----------------------------- local state ----------------------------- */
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<{ [key: string]: any } | null>(null);
  const isIOS = Platform.OS === 'ios';
  const buttonPaddingBottom = insets.bottom + (isIOS ? 25 : 0);
  const [refreshing, setRefreshing] = useState(false);

  /* ------------------------------ modals --------------------------------- */
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);

  /* ------------------------------ STDI list ------------------------------ */
  const { stdis, loading: stdisLoading } = useStdis();

  /* -------------------------- cloud functions --------------------------- */
  const functionsInstance = getFunctions(firebaseApp);

  interface ComputeHashedIdPayload { hashType: string; inputSUUID?: string }
  interface ComputeHashedIdResp   { hashedId: string }
  const computeHashedIdCF = httpsCallable<
    ComputeHashedIdPayload,
    ComputeHashedIdResp
  >(functionsInstance, 'computeHashedId');

  const getPublicProfileCF = httpsCallable(functionsInstance, 'getPublicProfile');

  interface HealthStatusesPayload {}
  interface HealthStatusesResp {
    statuses: Record<string, any>;
  }
  const getUserHealthStatusesCF = httpsCallable<
    HealthStatusesPayload,
    HealthStatusesResp
  >(functionsInstance, 'getUserHealthStatuses');

  /* ---------------------- initial profile check/load --------------------- */
  useEffect(() => {
    if (!user) {
      router.replace('/Login');
      return;
    }

    (async () => {
      try {
        const res = await getPublicProfileCF({});
        setProfileData(res.data);
      } catch (err: any) {
        if (err?.message?.includes('not-found') || err?.code === 'functions/not-found') {
          router.replace('/(onboarding)/ProfileSetup');
          return;
        }
        Alert.alert('Profile Error', err.message || 'Error loading profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  /* ----------------- load own health once STDI list ready ---------------- */
  useEffect(() => {
    if (user && stdis.length > 0) refreshHealthStatuses();
  }, [user, stdis]);

  async function refreshHealthStatuses() {
    try {
      const res = await getUserHealthStatusesCF({});
      setHealthStatuses(res.data?.statuses || {});
    } catch (err) {
      console.error('refreshHealthStatuses:', err);
    }
  }

  /* ---------------------------- event handlers --------------------------- */
  async function handlePullRefresh() {
    setRefreshing(true);
    await refreshHealthStatuses();
    setRefreshing(false);
  }
  
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  async function handleUpdateProfile(updatedName: string, updatedUri: string) {
    if (!user) {
      Alert.alert('Error', 'User is not logged in.');
      return;
    }
    try {
      const { data } = await computeHashedIdCF({ hashType: 'profile' });
      const psuuid = data.hashedId;
      const db = getFirestore(firebaseApp);

      let finalPhoto = updatedUri;
      if (updatedUri !== profileData?.imageUrl) {
        // delete old
        if (profileData?.imageUrl) {
          try {
            await deleteObject(ref(storage, `profileImages/${psuuid}.jpg`));
          } catch {}
        }
        // upload new
        if (updatedUri) {
          const blob = await (await fetch(updatedUri)).blob();
          await uploadBytes(ref(storage, `profileImages/${psuuid}.jpg`), blob);
          finalPhoto = await getDownloadURL(ref(storage, `profileImages/${psuuid}.jpg`));
        } else {
          finalPhoto = '';
        }
      }

      await updateDoc(doc(db, 'publicProfile', psuuid), {
        displayName: updatedName,
        imageUrl: finalPhoto,
      });

      setProfileData({ ...profileData, displayName: updatedName, imageUrl: finalPhoto });
      setEditProfileModalVisible(false);
    } catch (err: any) {
      console.error('Update profile error:', err);
      Alert.alert('Error', err.message);
    }
  }

  /* ----------------------------- load screen ----------------------------- */
  if (loading || stdisLoading) {
    return (
      <SafeAreaView style={theme.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.buttonPrimary.backgroundColor} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  /* --------------------------- main UI render ---------------------------- */
  return (
    <SafeAreaView style={theme.container}>
      {/* -------- fixed header -------- */}
      <ProfileHeader
        displayName={profileData?.displayName || 'Unnamed User'}
        imageUrl={profileData?.imageUrl || ''}
        onEditProfile={() => setEditProfileModalVisible(true)}
        onLogout={handleLogout}
      />

      {/* -------- flexible / scrollable middle -------- */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 15 }}>
        <Text style={theme.title}>Health Status</Text>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullRefresh}
              tintColor={theme.buttonPrimary.backgroundColor}
            />
          }
        >
          <HealthStatusArea stdis={stdis} statuses={healthStatuses} />
        </ScrollView>
      </View>

      {/* -------- fixed bottom button -------- */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: buttonPaddingBottom,
          backgroundColor: isIOS
            ? 'transparent'
            : theme.container.backgroundColor,
        }}
      >
        <ThemedButton
          title="Submit Test Results"
          variant="primary"
          onPress={() => setSubmitTestModalVisible(true)}
        />
      </View>

      {/* -------- modals -------- */}
      <EditProfileModal
        visible={editProfileModalVisible}
        initialDisplayName={profileData?.displayName || ''}
        initialPhotoUri={profileData?.imageUrl || ''}
        onCancel={() => setEditProfileModalVisible(false)}
        onSave={handleUpdateProfile}
      />

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
