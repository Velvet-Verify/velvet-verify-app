// app/(auth)/SignupScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { useRouter } from 'expo-router';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signUp, logout } = useAuth();
  const router = useRouter();

  // Password must be at least 8 characters with one uppercase, one lowercase, one number, and one special character.
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
      // After sign up, display an alert instructing the user to check their email.
      Alert.alert(
        'Verification Email Sent',
        'A verification email has been sent to your email address. Please verify your email before logging in.',
        [
          {
            text: 'OK',
            onPress: async () => {
              // Sign the user out so that they must log in from the LoginScreen.
              await logout();
              // Redirect to LoginScreen.
              router.replace('/LoginScreen');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Button title="Sign Up" onPress={handleSignup} />
      <View style={styles.toggleContainer}>
        <Text>Already have an account?</Text>
        <Button title="Go to Login" onPress={() => router.replace('/LoginScreen')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  toggleContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});
