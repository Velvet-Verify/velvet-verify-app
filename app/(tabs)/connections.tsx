// app/(tabs)/connections.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useConnections } from '@/src/context/ConnectionsContext';
import { useTheme } from 'styled-components/native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { getFirestore } from 'firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { useStdis } from '@/hooks/useStdis';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { NewConnection } from '@/components/connections/NewConnection';
import { ConnectionDetailsModal } from '@/components/connections/ConnectionDetailsModal';
import { ConnectionItem } from '@/components/connections/ConnectionItem';
import { useLookups } from '@/src/context/LookupContext';

/* ---------- base & merged-doc types ---------- */
export interface Connection {
  connectionDocId?: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
  connectionLevel: number;        // 1-5
  connectionStatus: number;       // 0=pending, 1=active
  senderSUUID: string;
  recipientSUUID: string;
  newAlert?: boolean;
}
interface DisplayConnection extends Connection {
  /* merged pending-elevation extras */
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
  pendingLevelId?: number;
}

/* ---------- screen ---------- */
export default function ConnectionsScreen() {
  const theme   = useTheme();
  const insets  = useSafeAreaInsets();
  const nav     = useNavigation();
  const db      = getFirestore(firebaseApp);
  const fns     = getFunctions(firebaseApp);

  const { user } = useAuth();
  const { connections, loading, refreshConnections, clearNewAlert } = useConnections();
  const { connectionLevels } = useLookups();
  const { stdis } = useStdis();

  /* ---------- local state ---------- */
  const [mySUUID, setMySUUID] = useState('');
  const [newModal, setNewModal] = useState(false);
  const [selConn,  setSelConn]  = useState<DisplayConnection | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  /* collapsible state per group */
  const [open, setOpen] = useState({
    bond: true, friend: true, fling: true, new: true, blocked: true,
  });

  /* ---------- compute my SUUID once ---------- */
  useEffect(() => {
    if (!user) return;
    httpsCallable(fns, 'computeHashedId')({ hashType: 'standard' })
      .then((r: any) => setMySUUID(r.data.hashedId))
      .catch((err) => console.warn('computeHashedId', err));
  }, [user, fns]);

  /* ---------- merge active & pending docs ---------- */
  const displayConnections = useMemo<DisplayConnection[]>(() => {
    function key(c: Connection) { return [c.senderSUUID, c.recipientSUUID].sort().join('_'); }

    const map = new Map<string, { active?: Connection; pending?: Connection }>();
    connections.filter((c) => [0, 1].includes(c.connectionStatus)).forEach((c) => {
      const k = key(c);
      if (!map.has(k)) map.set(k, {});
      c.connectionStatus === 1 ? (map.get(k)!.active  = c)
                               : (map.get(k)!.pending = c);
    });

    const out: DisplayConnection[] = [];
    map.forEach(({ active, pending }) => {
      if (active && pending) {
        out.push({
          ...active,
          pendingDocId:         pending.connectionDocId,
          pendingSenderSUUID:   pending.senderSUUID,
          pendingRecipientSUUID:pending.recipientSUUID,
          pendingLevelName:     connectionLevels[String(pending.connectionLevel)]?.name ??
                                `Level ${pending.connectionLevel}`,
          pendingLevelId:       pending.connectionLevel,
        });
      } else if (active)  {
        out.push({ ...active });
      } else if (pending) {
        out.push({ ...pending });
      }
    });
    return out;
  }, [connections, connectionLevels]);

  /* ---------- helper: does THIS user need to respond? ---------- */
  function needsMyAction(c: DisplayConnection) {
    return (
      /* recipient of pending request */
      (c.connectionStatus === 0 && c.recipientSUUID === mySUUID) ||
      /* recipient of pending elevation */
      (c.pendingDocId && c.pendingRecipientSUUID === mySUUID) ||
      /* sender of newly-accepted request that hasn’t been viewed */
      (c.connectionStatus === 1 && c.newAlert === true && c.senderSUUID === mySUUID)
    );
  }

  function handlePressConnection(c: DisplayConnection) {
    /* If I’m the sender & newAlert is true, flip locally then call CF */
    if (c.newAlert === true && c.senderSUUID === mySUUID) {
      clearNewAlert(c.connectionDocId!);                  // immediate UI update
      const markSeenCF = httpsCallable(fns, 'markConnectionSeen');
      markSeenCF({ docId: c.connectionDocId }).catch(console.warn); // fire-and-forget
    }
    setSelConn(c);
    setShowDetails(true);
  }

  /* ---------- group rows by active level (or 'New') ---------- */
  const groups = useMemo(() => {
    const blocked: DisplayConnection[] = [];
    const newOnes: DisplayConnection[] = [];
    const flings:  DisplayConnection[] = [];
    const friends: DisplayConnection[] = [];
    const bonds:   DisplayConnection[] = [];

    displayConnections.forEach((c) => {
      const lvl = c.connectionStatus === 1 ? c.connectionLevel : 2;
      switch (lvl) {
        case 1: blocked.push(c); break;
        case 2: newOnes.push(c); break;
        case 3: flings.push(c);  break;
        case 4: friends.push(c); break;
        case 5: bonds.push(c);   break;
      }
    });
    return { blocked, newOnes, flings, friends, bonds };
  }, [displayConnections]);

  /* ---------- UI helpers ---------- */
  function renderGroup(title: string, data: DisplayConnection[], key: keyof typeof open) {
    if (!data.length) return null;
    const icon = open[key] ? '▾' : '▸';
    return (
      <View style={{ marginBottom: 10 }}>
        <TouchableOpacity
          onPress={() => setOpen({ ...open, [key]: !open[key] })}
          style={styles.header} activeOpacity={0.8}>
          <Text style={styles.title}>{icon} {title}</Text>
        </TouchableOpacity>

        {open[key] && (
          <View style={{ paddingLeft: 10, marginTop: 5 }}>
            {data.map((c) => (
              <TouchableOpacity
                key={c.connectionDocId || Math.random().toString()}
                activeOpacity={0.7}
                onPress={() => handlePressConnection(c)}
              >
                <ConnectionItem
                  connection={c}
                  mySUUID={mySUUID}
                  highlight={needsMyAction(c)}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  /* ---------- render ---------- */
  if (loading) {
    return (
      <View style={[theme.centerContainer]}>
        <Text style={theme.title}>Loading connections…</Text>
      </View>
    );
  }

  const isIOS = Platform.OS === 'ios';
  const containerStyle = [
    theme.container,
    {
      paddingTop:    insets.top + 10,
      paddingBottom: isIOS ? insets.bottom + 60 : 15
    },
  ];

  return (
    <View style={containerStyle}>
      <Text style={theme.title}>Your Connections</Text>

      <FlatList
        data={[]} renderItem={() => null} keyExtractor={() => Math.random().toString()}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshConnections}
            tintColor={theme.buttonPrimary.backgroundColor}
          />
        }
        ListEmptyComponent={
          <View>
            {renderGroup('Bonded Partners', groups.bonds,   'bond')}
            {renderGroup('Friends',          groups.friends, 'friend')}
            {renderGroup('Flings',           groups.flings,  'fling')}
            {renderGroup('New',              groups.newOnes, 'new')}
            {renderGroup('Blocked',          groups.blocked, 'blocked')}

            {displayConnections.length === 0 && (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Text style={theme.bodyText}>No connections found.</Text>
              </View>
            )}
          </View>
        }
      />

      <ThemedButton
        title="New Connection"
        variant="primary"
        onPress={() => setNewModal(true)}
      />

      <NewConnection
        visible={newModal}
        onClose={() => setNewModal(false)}
      />

      {selConn && (
        <ConnectionDetailsModal
          visible={showDetails}
          onClose={() => { setShowDetails(false); setSelConn(null); }}
          connection={selConn}
          isRecipient={selConn.recipientSUUID === mySUUID}
          mySUUID={mySUUID}
          stdis={stdis}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  title:  { fontSize: 18, fontWeight: '600' },
});
