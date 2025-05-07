// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from 'firebase/auth';

import { auth } from '@/src/firebase';

interface AuthContextProps {
  user: any;
  loading: boolean;
  signIn:  (email: string, password: string) => Promise<void>;
  signUp:  (email: string, password: string) => Promise<void>;
  logout:  () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,    setUser]    = useState<any>(null);
  const [loading, setLoading] = useState(true); // <- NEW

  // Keep Firebase auth state in sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, usr => {
      setUser(usr);
      setLoading(false);
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
    const { user: newUser } = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await sendEmailVerification(newUser);
  };

  const signIn = async (email: string, password: string) => {
    const { user: usr } = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    if (!usr.emailVerified) {
      await signOut(auth);
      throw new Error('Please verify your e-mail before logging in.');
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
