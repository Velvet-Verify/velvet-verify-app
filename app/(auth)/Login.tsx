// app/(auth)/Login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from 'styled-components/native';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    try {
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
    }
  };

  return (
    <View style={theme.centerContainer}>
      <Text style={theme.title}>Login</Text>

      <TextInput
        style={theme.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={theme.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        title="Login"
        onPress={handleLogin}
        color={theme.buttonPrimary.backgroundColor}
      />

      <View style={{ marginTop: 20, alignItems: 'center' }}>
        <Text>Don't have an account?</Text>
        <Button
          title="Go to Sign Up"
          onPress={() => router.replace('/Signup')}
          color={theme.buttonSecondary.backgroundColor}
        />
      </View>
    </View>
  );
}
