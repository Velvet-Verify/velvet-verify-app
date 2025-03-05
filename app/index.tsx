// app/index.tsx
import React from 'react';
import { Text, View } from 'react-native';
import Constants from 'expo-constants';

export default function TestEnv() {
  // Use expoConfig instead of manifest
  const extra = Constants.expoConfig?.extra;
  const firebaseApiKey = extra?.firebaseApiKey;

  return (
    <View>
      <Text>Firebase API Key: {firebaseApiKey}</Text>
    </View>
  );
}
