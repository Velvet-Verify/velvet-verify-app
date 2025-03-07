import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
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
    <View style={[styles.container, theme.container]}>
      <Text style={[styles.title, theme.title]}>Sign Up</Text>
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
      <Button 
        title="Sign Up" 
        onPress={handleSignup} 
        color={theme.buttonPrimary.backgroundColor}
      />
      <View style={styles.toggleContainer}>
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
    borderColor: '#ccc', // Can be updated to a theme color later.
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  toggleContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});
