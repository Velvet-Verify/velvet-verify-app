// app/_layout.tsx
import React from 'react';
import { Slot, useSegments, useRouter } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider } from 'styled-components/native';
import Themes from '@/constants/Themes';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { LookupProvider } from '@/src/context/LookupContext';
import { MembershipProvider } from '@/src/context/MembershipContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <LookupProvider>
        <MembershipProvider>
          <InnerLayout />
        </MembershipProvider>
      </LookupProvider>
    </AuthProvider>
  );
}

function InnerLayout() {
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!user || !user.emailVerified) {
      if (!inAuthGroup) {
        router.replace('/Login');
      }
    } else {
      // user is verified
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