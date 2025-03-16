// app/(auth)/_layout.tsx
import React from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';

export default function AuthLayout() {
  // Could do styling or a “card” layout for login pages
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Slot />
    </View>
  );
}
