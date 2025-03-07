// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Slot, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from 'styled-components/native';
import Themes from '@/constants/Themes';

function AuthRedirect() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (user && user.emailVerified) {
      router.replace('/');
    } else {
      router.replace('/Login');
    }
  }, [mounted, user, router]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <ThemeProvider theme={Themes.light}>
          <AuthRedirect />
          <Slot />
        </ThemeProvider>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
