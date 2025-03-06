// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { computePSUUIDFromSUUID } from '@/src/utils/hash';

export default function HomeScreen() {
  const { user, suuid } = useAuth();
  const router = useRouter();
  const db = getFirestore(firebaseApp);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkProfile() {
      if (user && suuid) {
        const psuuid = await computePSUUIDFromSUUID(suuid);
        const profileDocRef = doc(db, 'publicProfile', psuuid);
        const docSnap = await getDoc(profileDocRef);
        if (!docSnap.exists()) {
          // Public profile doesn't exist, redirect to ProfileSetup
          router.replace('/(onboarding)/ProfileSetup');
        } else {
          setLoading(false);
        }
      }
    }
    checkProfile();
  }, [user, suuid, db, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>
      <Text>Welcome, {user?.email}</Text>
      {/* More content can go here */}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
  },
});
