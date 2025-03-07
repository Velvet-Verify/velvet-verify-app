import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
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
      // Successful login will be handled by the RootLayout's redirection.
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
    }
  };

  return (
    <View style={[styles.container, theme.container]}>
      <Text style={[styles.title, theme.title]}>Login</Text>
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
      <Button 
        title="Login" 
        onPress={handleLogin} 
        color={theme.buttonPrimary.backgroundColor}
      />
      <View style={styles.toggleContainer}>
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
    borderColor: '#ccc', // You can update this later with a theme value.
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  toggleContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});
