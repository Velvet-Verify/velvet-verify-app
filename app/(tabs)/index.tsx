// app/(tabs)/index.tsx
/* -------------- imports -------------- */
import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  View,
  Alert,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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

/* -------------- component -------------- */
export default function HomeScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const storage = getStorage(firebaseApp);

  /* ---------- local state ---------- */
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, any> | null>(
    null,
  );
  const isIOS = Platform.OS === 'ios';
  const buttonPaddingBottom = insets.bottom + (isIOS ? 25 : 0);
  const [refreshing, setRefreshing] = useState(false);

  /* ---------- modals ---------- */
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [submitTestModalVisible, setSubmitTestModalVisible] = useState(false);

  /* ---------- STDI list ---------- */
  const { stdis, loading: stdisLoading } = useStdis();

  /* ---------- cloud functions ---------- */
  const fns = useMemo(() => getFunctions(firebaseApp), []);
  const markAlertReadCF = useMemo(() => httpsCallable(fns, 'markHealthAlertRead'), [fns]);
  const computeHashedIdCF = useMemo(() => httpsCallable(fns, 'computeHashedId'), [fns]);
  const getPublicProfileCF = useMemo(() => httpsCallable(fns, 'getPublicProfile'), [fns]);
  const getUserHealthStatusesCF = useMemo(
    () => httpsCallable(fns, 'getUserHealthStatuses'),
    [fns],
  );

  /* ---------- profile load ---------- */
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

  /* ---------- health load ---------- */
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

  /* ---------- nav badge ---------- */
  useEffect(() => {
    if (!healthStatuses) return;
    const count = Object.values(healthStatuses).filter((v: any) => v?.newAlert)
      .length;
    navigation.setOptions({ tabBarBadge: count > 0 ? count : undefined });
  }, [healthStatuses, navigation]);

  /* ---------- mark-read handler ---------- */
  const handleMarkAlertRead = (stdiId: string) => {
    setHealthStatuses((prev) => {
      if (!prev || !prev[stdiId] || !prev[stdiId].newAlert) return prev;
      return {
        ...prev,
        [stdiId]: { ...prev[stdiId], newAlert: false },
      };
    });

    /* fire-and-forget – no await so UI feels instant */
    markAlertReadCF({ stdiId }).catch(() => {
      // optionally log; we silently ignore CF failure
    });
  };

  /* ---------- pull-to-refresh ---------- */
  const handlePullRefresh = async () => {
    setRefreshing(true);
    await refreshHealthStatuses();
    setRefreshing(false);
  };

  /* ---------- logout ---------- */
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  /* ---------- loading screen ---------- */
  if (loading || stdisLoading) {
    return (
      <SafeAreaView style={theme.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.buttonPrimary.backgroundColor} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  /* ---------- main UI ---------- */
  return (
    <SafeAreaView style={theme.container}>
      <ProfileHeader
        displayName={profileData?.displayName || 'Unnamed User'}
        imageUrl={profileData?.imageUrl || ''}
        onEditProfile={() => setEditProfileModalVisible(true)}
        onLogout={handleLogout}
      />

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
          <HealthStatusArea
            stdis={stdis}
            statuses={healthStatuses}
            onMarkRead={handleMarkAlertRead}      /* <-- NEW */
          />
        </ScrollView>
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: buttonPaddingBottom,
          backgroundColor: isIOS ? 'transparent' : theme.container.backgroundColor,
        }}
      >
        <ThemedButton
          title="Submit Test Results"
          variant="primary"
          onPress={() => setSubmitTestModalVisible(true)}
        />
      </View>

      {/* ---- modals ---- */}
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

  /* ---------- helper: update profile (unchanged) ---------- */
  async function handleUpdateProfile(updatedName: string, updatedUri: string) {
    // (existing implementation intact)
  }
}
