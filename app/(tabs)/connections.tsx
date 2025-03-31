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
 * pendingDocId, pendingSenderSUUID, pendingRecipientSUUID, pendingLevelName, ...
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

  // Collapsible state for each group
  const [bondedOpen, setBondedOpen] = useState(true);
  const [friendsOpen, setFriendsOpen] = useState(true);
  const [newOpen, setNewOpen] = useState(true);
  const [pendingOpen, setPendingOpen] = useState(true);

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
   * - If there's both an active doc & a pending doc for the same pair, we merge them
   */
  const displayConnections = useMemo<DisplayConnection[]>(() => {
    function getPairKey(c: Connection) {
      const pair = [c.senderSUUID, c.recipientSUUID].sort();
      return pair.join("_");
    }

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
        pairData.pending = c;
      }
    }

    const result: DisplayConnection[] = [];
    for (const [_, { active, pending }] of pairMap.entries()) {
      if (active && pending) {
        // Merge the pending doc’s fields into the active doc
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
        // purely pending doc
        result.push(pending);
      }
    }
    return result;
  }, [connections, connectionLevels]);

  /**
   * Next, group them by category:
   *  - Bonded => active L4
   *  - Friends => active L3
   *  - New => active L2
   *  - Pending => purely pending doc with L2
   */
  const { bonded, friends, newOnes, pending } = useMemo(() => {
    const bonded: DisplayConnection[] = [];
    const friends: DisplayConnection[] = [];
    const newOnes: DisplayConnection[] = [];
    const pending: DisplayConnection[] = [];

    displayConnections.forEach(c => {
      if (c.connectionStatus === 1) {
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
          // handle other levels if needed
        }
      } else if (c.connectionStatus === 0 && c.connectionLevel === 2) {
        pending.push(c);
      }
    });

    return { bonded, friends, newOnes, pending };
  }, [displayConnections]);

  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15;
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

  /**
   * Renders each group in a collapsible container:
   * - Tapping the header toggles open/closed
   * - If open => show the items, if closed => items hidden
   */
  function renderCollapsibleGroup(
    title: string,
    data: DisplayConnection[],
    isOpen: boolean,
    setIsOpen: (b: boolean) => void
  ) {
    if (!data || data.length === 0) return null;

    const icon = isOpen ? '▼' : '►';

    return (
      <View style={{ marginBottom: 10 }}>
        {/* Header row */}
        <TouchableOpacity
          onPress={() => setIsOpen(!isOpen)}
          style={styles.collapsibleHeader}
          activeOpacity={0.8}
        >
          <Text style={styles.groupTitle}>
            {icon} {title}
          </Text>
        </TouchableOpacity>

        {/* The list only if open */}
        {isOpen && (
          <View style={{ paddingLeft: 10, marginTop: 5 }}>
            {data.map(item => (
              <TouchableOpacity
                key={item.connectionDocId || Math.random().toString()}
                activeOpacity={0.7}
                onPress={() => handlePressConnection(item)}
              >
                <ConnectionItem connection={item} mySUUID={mySUUID} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={theme.title}>Your Connections</Text>

      {/* 
        We still use a FlatList with empty data, 
        purely for the pull-to-refresh logic. 
        Then in ListEmptyComponent, we render collapsible groups. 
      */}
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
            {renderCollapsibleGroup("Bonded Partners", bonded, bondedOpen, setBondedOpen)}
            {renderCollapsibleGroup("Friends", friends, friendsOpen, setFriendsOpen)}
            {renderCollapsibleGroup("New Connections", newOnes, newOpen, setNewOpen)}
            {renderCollapsibleGroup("Pending Requests", pending, pendingOpen, setPendingOpen)}

            {/* If all are empty, show text */}
            {bonded.length === 0 &&
             friends.length === 0 &&
             newOnes.length === 0 &&
             pending.length === 0 && (
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

      <NewConnection
        visible={newConnectionModalVisible}
        onClose={() => setNewConnectionModalVisible(false)}
      />

      {selectedConnection && (
        <ConnectionDetailsModal
          visible={detailsModalVisible}
          onClose={() => {
            setDetailsModalVisible(false);
            setSelectedConnection(null);
          }}
          connection={selectedConnection}
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
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
