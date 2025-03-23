// src/context/ConnectionsContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

export interface Connection {
  connectionDocId: string;  // We store doc ID here
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
  senderSUUID: string;
  recipientSUUID: string;
}

/** Context shape */
interface ConnectionsContextProps {
  connections: Connection[];
  loading: boolean;
  refreshConnections: () => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextProps | undefined>(undefined);

/** 
 * This provider calls your 'getConnections' CF, stores them in state,
 * and makes them accessible to any child components.
 */
export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const functionsInstance = getFunctions(firebaseApp);
  const getConnectionsCF = httpsCallable(functionsInstance, 'getConnections');

  async function refreshConnections() {
    setLoading(true);
    try {
      // getConnectionsCF presumably returns an array of objects
      // each having e.g. docId => we store as connectionDocId
      const result = await getConnectionsCF({});
      // result.data might be an array of these connections
      // Make sure the shape matches your type above
      const data = (result.data as any[]) || [];
      setConnections(data);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshConnections();
  }, []);

  const value: ConnectionsContextProps = {
    connections,
    loading,
    refreshConnections,
  };

  return (
    <ConnectionsContext.Provider value={value}>
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections() {
  const context = useContext(ConnectionsContext);
  if (!context) {
    throw new Error('useConnections must be used within a ConnectionsProvider');
  }
  return context;
}