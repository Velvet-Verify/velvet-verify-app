// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Button, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { computePSUUIDFromSUUID } from '@/src/utils/hash';

export default function HomeScreen() {
  const { user, suuid, logout } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    async function checkProfile() {
      if (user && suuid) {
        const psuuid = await computePSUUIDFromSUUID(suuid);
        const profileDocRef = doc(db, 'publicProfile', psuuid);
        const docSnap = await getDoc(profileDocRef);
        if (!docSnap.exists()) {
          // Public profile doesn't exist, redirect to ProfileSetup.
          router.replace('/ProfileSetup');
        } else {
          setProfileData(docSnap.data());
          setLoading(false);
        }
      }
    }
    checkProfile();
  }, [user, suuid, db, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (error) {
      console.error('Logout failed:', error);
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
        <Text style={styles.title}>Home Screen</Text>
        {profileData?.imageUrl ? (
          <Image source={{ uri: profileData.imageUrl }} style={styles.profileImage} />
        ) : (
          <Text style={styles.noImageText}>No profile picture available</Text>
        )}
        <Text style={styles.displayName}>Welcome, {profileData?.displayName}</Text>
        <View style={[styles.logoutButtonContainer, { bottom: insets.bottom + 20 }]}>
          <Button title="Logout" onPress={handleLogout} />
        </View>
      </View>
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
    // Remove fixed paddingBottom and use insets for bottom spacing.
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  displayName: {
    fontSize: 20,
    marginVertical: 10,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
  },
  noImageText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#888',
  },
  logoutButtonContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
});
