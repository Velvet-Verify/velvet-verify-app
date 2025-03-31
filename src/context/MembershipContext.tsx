// src/context/MembershipContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { firebaseApp } from '../firebase/config';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface MembershipData {
  premium: boolean;
  expirationDate?: string;
}

interface MembershipContextProps {
  membership: MembershipData | null;
  loading: boolean;
  refreshMembership: () => Promise<void>;
}

const MembershipContext = createContext<MembershipContextProps | undefined>(undefined);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [membership, setMembership] = useState<MembershipData | null>(null);
  const [loading, setLoading] = useState(true);

  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, 'computeHashedId');
  const db = getFirestore(firebaseApp);

  async function loadMembership() {
    if (!user) {
      setMembership(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1) compute membership hash => muuid
      const muuidResult = await computeHashedIdCF({ hashType: 'membership' });
      const muuid = muuidResult.data.hashedId as string;

      // 2) doc ref => 'memberships/{muuid}'
      const docRef = doc(db, 'memberships', muuid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        // no doc => user is free
        setMembership({ premium: false });
      } else {
        const data = snap.data();
        // e.g. data.endDate => "2025-04-12T15:30:00.000Z"
        if (!data.endDate) {
          setMembership({ premium: false });
        } else {
          const now = new Date();
          const end = new Date(data.endDate);
          const isActive = end >= now; // if membership is still valid
          setMembership({
            premium: isActive,
            expirationDate: data.endDate,
          });
        }
      }
    } catch (err) {
      console.error('Error loading membership data:', err);
      setMembership({ premium: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembership();
  }, [user]);

  const value: MembershipContextProps = {
    membership,
    loading,
    refreshMembership: loadMembership,
  };

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  const context = useContext(MembershipContext);
  if (context === undefined) {
    throw new Error('useMembership must be used within a MembershipProvider');
  }
  return context;
}