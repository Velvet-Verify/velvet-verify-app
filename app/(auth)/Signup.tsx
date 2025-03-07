// app/(auth)/Signup.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from 'styled-components/native';

export default function SignupScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signUp, logout } = useAuth();
  const router = useRouter();

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }
    if (!passwordRegex.test(password)) {
      Alert.alert(
        'Error',
        'Password must be at least 8 characters and include one uppercase letter, one lowercase letter, one number, and one special character.'
      );
      return;
    }
    try {
      await signUp(email, password);
      Alert.alert(
        'Verification Email Sent',
        'A verification email has been sent to your email address. Please verify your email before logging in.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
              router.replace('/Login');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Error', error.message);
    }
  };

  return (
    <View style={theme.centerContainer}>
      <Text style={theme.title}>Sign Up</Text>

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
      <TextInput
        style={theme.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <Button
        title="Sign Up"
        onPress={handleSignup}
        color={theme.buttonPrimary.backgroundColor}
      />

      <View style={{ marginTop: 20, alignItems: 'center' }}>
        <Text>Already have an account?</Text>
        <Button
          title="Go to Login"
          onPress={() => router.replace('/Login')}
          color={theme.buttonSecondary.backgroundColor}
        />
      </View>
    </View>
  );
}
