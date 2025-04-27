// src/context/ConnectionsContext.tsx
import React, {
  createContext, useContext, useState, useEffect, useMemo, ReactNode,
} from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

export interface Connection {
  connectionDocId: string;
  displayName:     string | null;
  imageUrl:        string | null;
  createdAt:       string | null;
  updatedAt:       string | null;
  expiresAt:       string | null;
  connectionLevel: number;   // 1–5
  connectionStatus:number;   // 0=pending, 1=active
  senderSUUID:     string;
  recipientSUUID:  string;
  newAlert?:       boolean;

  /* merge extras */
  pendingDocId?:          string;
  pendingSenderSUUID?:    string;
  pendingRecipientSUUID?: string;
}

interface ConnectionsContextProps {
  connections:      Connection[];
  loading:          boolean;
  refreshConnections: () => Promise<void>;
  alertCount:       number;
  /** flip newAlert locally so UI/badge update immediately */
  clearNewAlert:    (docId: string) => void;
}

const ConnectionsContext = createContext<ConnectionsContextProps | undefined>(undefined);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading,      setLoading]    = useState(true);
  const [mySUUID,      setMySUUID]    = useState<string>('');

  /* Firebase callables */
  const fns             = getFunctions(firebaseApp);
  const getConnections  = httpsCallable(fns, 'getConnections');
  const computeHashedId = httpsCallable(fns, 'computeHashedId');

  /* caller’s SUUID */
  useEffect(() => {
    computeHashedId({ hashType: 'standard' })
      .then((r: any) => setMySUUID(r.data.hashedId))
      .catch(console.warn);
  }, [computeHashedId]);

  /* fetch list */
  async function refreshConnections() {
    setLoading(true);
    try {
      const res: any = await getConnections({});
      setConnections((res.data as Connection[]) || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refreshConnections(); }, []);  // on mount

  /* local updater */
  function clearNewAlert(docId: string) {
    setConnections(prev =>
      prev.map(c =>
        c.connectionDocId === docId ? { ...c, newAlert: false } : c
      )
    );
  }

  /* badge logic */
  const needsMyAction = (c: Connection) =>
    (c.connectionStatus === 0 && c.recipientSUUID === mySUUID) ||
    (c.pendingDocId && c.pendingRecipientSUUID === mySUUID)   ||
    (c.connectionStatus === 1 && c.newAlert === true && c.senderSUUID === mySUUID);

  const alertCount = useMemo(
    () => (mySUUID ? connections.filter(needsMyAction).length : 0),
    [connections, mySUUID],
  );

  return (
    <ConnectionsContext.Provider
      value={{ connections, loading, refreshConnections, alertCount, clearNewAlert }}  /* ← added */
    >
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections() {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) throw new Error('useConnections must be used within a ConnectionsProvider');
  return ctx;
}
