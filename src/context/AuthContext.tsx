// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from 'firebase/auth';
import { firebaseApp } from '../firebase/config';
import { computeHashedId } from '@/src/utils/hash'; // Updated import

const auth = getAuth(firebaseApp);

interface AuthContextProps {
  user: any;
  suuid: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [suuid, setSUUID] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usr) => {
      setUser(usr);
      if (usr) {
        // Compute and store the SUUID using the new function.
        const computed = await computeHashedId('standard');
        // console.log("Computed SUUID:", computed); // Log to validate the computed value
        setSUUID(computed);
      } else {
        setSUUID(null);
      }
    });
    return unsubscribe;
  }, []);

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser(auth.currentUser);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;
      await sendEmailVerification(newUser);
    } catch (error) {
      console.error('Error during sign-up:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const usr = userCredential.user;
      if (!usr.emailVerified) {
        await signOut(auth);
        throw new Error("Your email is not verified. Please verify your email before logging in.");
      }
    } catch (error) {
      console.error('Error during sign-in:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, suuid, signIn, signUp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
