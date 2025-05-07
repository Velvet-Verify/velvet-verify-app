// app/_layout.tsx
import React from 'react';
import { Slot, useSegments, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from 'styled-components/native';
import Themes from '@/constants/Themes';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { LookupProvider } from '@/src/context/LookupContext';
import { MembershipProvider } from '@/src/context/MembershipContext';

if (typeof global.document === 'undefined') global.document = {};

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
  const { user, loading } = useAuth();
  const segments            = useSegments();      // ["(auth)", "Login"]  etc.
  const router              = useRouter();

  React.useEffect(() => {
    if (loading) return;                          // still waiting for Firebase

    const inAuthGroup = segments[0] === '(auth)';

    if (!user || !user.emailVerified) {
      if (!inAuthGroup) router.replace('/Login');
    } else {
      // logged-in → kick the user **out** of the auth group
      if (inAuthGroup) router.replace('/');
    }
  }, [loading, user, segments, router]);

  // While Firebase is telling us who the user is, render nothing
  if (loading) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={Themes.light}>
        {/* <Slot /> mounts the correct stack (auth or main) once the redirect logic above settles */}
        <Slot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}