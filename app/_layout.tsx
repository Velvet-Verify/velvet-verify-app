// app/_layout.tsx
import React from 'react';
import { Slot } from 'expo-router';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useSegments, useRouter } from 'expo-router';
import { ThemeProvider } from 'styled-components/native';
import Themes from '@/constants/Themes';

export default function RootLayout() {
  return (
    <AuthProvider>
      <InnerLayout />
    </AuthProvider>
  );
}

function InnerLayout() {
  // Now we can safely call useAuth() because AuthProvider is one level above
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Example route-guard effect
  React.useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!user || !user.emailVerified) {
      if (!inAuthGroup) {
        router.replace('/Login');
      }
    } else {
      if (inAuthGroup) {
        router.replace('/');
      }
    }
  }, [user, segments, router]);

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={Themes.light}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Slot />
        </SafeAreaView>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
