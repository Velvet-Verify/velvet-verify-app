// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { Slot, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';

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
      <AuthRedirect />
      <Slot />
    </AuthProvider>
  );
}
