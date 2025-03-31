// app/(tabs)/connections.tsx

import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnections } from "@/src/context/ConnectionsContext";
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { useAuth } from "@/src/context/AuthContext";
import { useStdis } from "@/hooks/useStdis";
import { ThemedButton } from "@/components/ui/ThemedButton";
import { NewConnection } from "@/components/connections/NewConnection";
import { ConnectionDetailsModal } from "@/components/connections/ConnectionDetailsModal";
import { ConnectionItem } from "@/components/connections/ConnectionItem";
import { useLookups } from "@/src/context/LookupContext";

export interface Connection {
  connectionDocId?: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;       // e.g. 2=New,3=Friend,4=Bond
  connectionStatus: number;      // 0 => pending, 1 => active, 5 => cancelled, etc.
  senderSUUID: string;
  recipientSUUID: string;
}

/** 
 * For merging, we store info about a second doc:
 * pendingDocId, pendingSenderSUUID, pendingRecipientSUUID, pendingLevelName
 */
interface DisplayConnection extends Connection {
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
  pendingLevelId?: number; // optionally store numeric ID
}

export default function ConnectionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { connections, loading, refreshConnections } = useConnections();
  const { connectionLevels } = useLookups();

  const [newConnectionModalVisible, setNewConnectionModalVisible] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<DisplayConnection | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [mySUUID, setMySUUID] = useState<string>("");

  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, "computeHashedId");
  const { user } = useAuth();
  const { stdis } = useStdis();

  // 1) Compute the user’s SUUID
  useEffect(() => {
    async function fetchMySUUID() {
      if (!user) return;
      try {
        const result = await computeHashedIdCF({ hashType: "standard" });
        setMySUUID(result.data.hashedId);
      } catch (err) {
        console.error("Error computing my SUUID:", err);
      }
    }
    fetchMySUUID();
  }, [user]);

  /**
   * Build a single array of “display connections” from the raw `connections`.
   * - If there's both an active doc & a pending doc for the same pair, we merge them into the active item 
   *   by adding e.g. pendingDocId, pendingLevelName, etc.
   * - If there's only an active doc or only a pending doc, we keep it as-is.
   */
  const displayConnections = useMemo<DisplayConnection[]>(() => {
    function getPairKey(c: Connection) {
      const pair = [c.senderSUUID, c.recipientSUUID].sort();
      return pair.join("_");
    }

    // We'll store each pair's active doc + pending doc
    const pairMap = new Map<string, { active?: Connection; pending?: Connection }>();

    // Filter out canceled, rejected, etc. Keep only pending(0) or active(1).
    const relevant = connections.filter(c => [0, 1].includes(c.connectionStatus));

    for (const c of relevant) {
      const key = getPairKey(c);
      if (!pairMap.has(key)) {
        pairMap.set(key, {});
      }
      const pairData = pairMap.get(key)!;

      if (c.connectionStatus === 1) {
        pairData.active = c;
      } else {
        // c.connectionStatus === 0
        pairData.pending = c;
      }
    }

    // Now combine them
    const result: DisplayConnection[] = [];
    for (const [_, { active, pending }] of pairMap.entries()) {
      if (active && pending) {
        // Merge the pending doc’s details into the active doc
        const lvl = connectionLevels[String(pending.connectionLevel)];
        const pendingLevelName = lvl?.name ?? `Level ${pending.connectionLevel}`;
        const mergedActive: DisplayConnection = {
          ...active,
          pendingDocId: pending.connectionDocId,
          pendingSenderSUUID: pending.senderSUUID,
          pendingRecipientSUUID: pending.recipientSUUID,
          pendingLevelName,
          pendingLevelId: pending.connectionLevel,
        };
        result.push(mergedActive);
      } else if (active) {
        result.push(active);
      } else if (pending) {
        // No active doc => purely pending doc
        result.push(pending);
      }
    }
    return result;
  }, [connections, connectionLevels]);

  /**
   * Next, group them by their “effective” category:
   * 1) Bonded Partners => active L4
   * 2) Friends => active L3
   * 3) New => active L2
   * 4) Pending => connectionStatus=0, connectionLevel=2 (only doc)
   */
  const { bonded, friends, newOnes, pending } = useMemo(() => {
    const bonded: DisplayConnection[] = [];
    const friends: DisplayConnection[] = [];
    const newOnes: DisplayConnection[] = [];
    const pending: DisplayConnection[] = [];

    displayConnections.forEach((c) => {
      if (c.connectionStatus === 1) {
        // Active doc => put in L4=Bonded, L3=Friend, or L2=New
        switch (c.connectionLevel) {
          case 4:
            bonded.push(c);
            break;
          case 3:
            friends.push(c);
            break;
          case 2:
            newOnes.push(c);
            break;
          default:
            // ignore or handle other levels if you have them
            break;
        }
      } else if (c.connectionStatus === 0) {
        // This means there's no active doc overshadowing it,
        // so we put it in “Pending” only if c.connectionLevel=2
        if (c.connectionLevel === 2) {
          pending.push(c);
        } 
        // If c.connectionLevel=3 or 4 with status=0, that would typically 
        // be a “pending elevation,” but it’d be merged into the active doc above,
        // so we usually wouldn’t see it as a separate item here.
      }
    });

    return { bonded, friends, newOnes, pending };
  }, [displayConnections]);

  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15;

  // Container style
  const containerStyle = [theme.container, { paddingBottom: bottomPadding }];

  function handlePressConnection(connection: DisplayConnection) {
    setSelectedConnection(connection);
    setDetailsModalVisible(true);
  }

  // If still loading, show spinner
  if (loading) {
    return (
      <View style={[theme.centerContainer]}>
        <Text style={theme.title}>Loading connections...</Text>
      </View>
    );
  }

  // Helper to render each group’s list:
  function renderGroup(title: string, data: DisplayConnection[]) {
    if (!data || data.length === 0) return null;
    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.groupTitle}>{title}</Text>
        {data.map((item) => (
          <TouchableOpacity
            key={item.connectionDocId || Math.random().toString()}
            activeOpacity={0.7}
            onPress={() => handlePressConnection(item)}
          >
            <ConnectionItem connection={item} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={theme.title}>Your Connections</Text>

      {/* Pull-to-refresh or manual refresh */}
      <FlatList
        data={[]} 
        keyExtractor={() => Math.random().toString()}
        renderItem={() => null}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshConnections}
            tintColor={theme.buttonPrimary.backgroundColor}
          />
        }
        ListEmptyComponent={
          <View style={{ paddingBottom: bottomPadding }}>
            {/* BOND: L4 */}
            {renderGroup("Bonded Partners", bonded)}
            {/* FRIEND: L3 */}
            {renderGroup("Friends", friends)}
            {/* NEW: L2 */}
            {renderGroup("New Connections", newOnes)}
            {/* PENDING: status=0, level=2 */}
            {renderGroup("Pending Requests", pending)}

            {/* If all are empty, show text */}
            {bonded.length === 0 && friends.length === 0 && newOnes.length === 0 && pending.length === 0 && (
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
        onPress={() => setNewConnectionModalVisible(true)}
      />

      {/* NewConnection modal */}
      <NewConnection
        visible={newConnectionModalVisible}
        onClose={() => setNewConnectionModalVisible(false)}
      />

      {/* Connection details */}
      {selectedConnection && (
        <ConnectionDetailsModal
          visible={detailsModalVisible}
          onClose={() => {
            setDetailsModalVisible(false);
            setSelectedConnection(null);
          }}
          connection={selectedConnection}
          // If the user is the base doc's recipient => isRecipient = true
          isRecipient={selectedConnection.recipientSUUID === mySUUID}
          mySUUID={mySUUID}
          stdis={stdis}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 8,
  },
});