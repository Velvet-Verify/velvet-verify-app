// src/context/LookupContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { useAuth } from './AuthContext';

/** Document structure for STDI, connectionLevels, etc. */
export interface STDI {
  id: string;
  name?: string;
  windowPeriodMax?: number;
  // add other fields if needed
}

export interface ConnectionLevel {
  id: string;
  name: string;
  description: string;
}

export interface ConnectionStatus {
  id: string;
  name: string;
  description?: string; // you could add if your doc has it
}

interface LookupData {
  stdis: STDI[];
  connectionLevels: { [id: string]: ConnectionLevel };
  connectionStatuses: { [id: string]: ConnectionStatus };
  loading: boolean;
}

/** The shape of our context value. */
interface LookupContextProps extends LookupData {
  refreshLookups: () => Promise<void>;
}

/** Create the Context with a default stub. */
const LookupContext = createContext<LookupContextProps | undefined>(undefined);

/**
 * The provider that loads STDI, connectionLevels, and connectionStatuses
 * once after the user logs in. 
 */
export function LookupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth(); 
  const db = getFirestore(firebaseApp);

  const [stdis, setStdis] = useState<STDI[]>([]);
  const [connectionLevels, setConnectionLevels] = useState<{ [id: string]: ConnectionLevel }>({});
  const [connectionStatuses, setConnectionStatuses] = useState<{ [id: string]: ConnectionStatus }>({});
  const [loading, setLoading] = useState<boolean>(true);

  /** This function fetches all needed data from Firestore once. */
  async function loadLookups() {
    if (!user) {
      // If no user, either skip or set empty
      setStdis([]);
      setConnectionLevels({});
      setConnectionStatuses({});
      return;
    }
    setLoading(true);

    try {
      // 1) Load STDI
      const stdiSnap = await getDocs(collection(db, 'STDI'));
      const stdiList: STDI[] = stdiSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as STDI[];

      // 2) Load connectionLevels
      const lvlSnap = await getDocs(collection(db, 'connectionLevels'));
      const lvlMap: { [id: string]: ConnectionLevel } = {};
      lvlSnap.forEach(doc => {
        lvlMap[doc.id] = { id: doc.id, ...doc.data() } as ConnectionLevel;
      });

      // 3) Load connectionStatuses
      const statSnap = await getDocs(collection(db, 'connectionStatuses'));
      const statMap: { [id: string]: ConnectionStatus } = {};
      statSnap.forEach(doc => {
        statMap[doc.id] = { id: doc.id, ...doc.data() } as ConnectionStatus;
      });

      // Update states
      setStdis(stdiList);
      setConnectionLevels(lvlMap);
      setConnectionStatuses(statMap);
    } catch (err) {
      console.error('Error loading lookups:', err);
    } finally {
      setLoading(false);
    }
  }

  /** Exposed method if we ever want to refresh manually. */
  async function refreshLookups() {
    await loadLookups();
  }

  // Load them once on mount after user logs in
  useEffect(() => {
    if (user) {
      loadLookups();
    } else {
      // If user logs out, clear data or keep as is
      setStdis([]);
      setConnectionLevels({});
      setConnectionStatuses({});
      setLoading(false);
    }
  }, [user]);

  const value: LookupContextProps = {
    stdis,
    connectionLevels,
    connectionStatuses,
    loading,
    refreshLookups,
  };

  return (
    <LookupContext.Provider value={value}>
      {children}
    </LookupContext.Provider>
  );
}

/** Simple hook to use the LookupContext. */
export function useLookups() {
  const context = useContext(LookupContext);
  if (!context) {
    throw new Error('useLookups must be used within a LookupProvider');
  }
  return context;
}
