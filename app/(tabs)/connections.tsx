// app/(tabs)/connections.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl,
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
 * We'll produce a 'DisplayConnection' for each pair. 
 * If there's a second doc pending for that pair, we store it in memory fields
 * (pendingDocId, pendingSenderSUUID, pendingLevelName).
 */
interface DisplayConnection extends Connection {
  pendingDocId?: string;         // ID of the second doc
  pendingSenderSUUID?: string;   // who created the pending doc
  pendingLevelName?: string;     // e.g. "Friend", "Bond"
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

  // 2) Build final array, skipping a second display for the pending doc if an active doc also exists
  const displayConnections = useMemo<DisplayConnection[]>(() => {
    // group docs by (sender,recipient) ignoring order
    function getPairKey(c: Connection) {
      const pair = [c.senderSUUID, c.recipientSUUID].sort();
      return pair.join("_");
    }

    // store pair => { active?: Connection, pending?: Connection }
    const pairMap = new Map<string, { active?: Connection; pending?: Connection }>();

    // put each doc in pairMap
    for (const c of connections) {
      // If you want to also include status=2,5, etc. in final display, do so.
      // We'll skip them if we only want active(1) or pending(0).
      if (![0,1].includes(c.connectionStatus)) {
        // or if you want to show them, remove this continue
        continue;
      }
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

    for (const [key, { active, pending }] of pairMap.entries()) {
      if (active && pending) {
        // We have both an active doc & a pending doc for this pair.
        // We ONLY want to display the active doc. 
        // But we store references to the pending doc inside the active doc
        // so we can show "(Friend Request Pending)" or let them "Cancel."

        // e.g. find the pending doc’s level name
        const lvl = connectionLevels[String(pending.connectionLevel)];
        const pendingLevelName = lvl?.name ?? `Level ${pending.connectionLevel}`;

        // create a new DisplayConnection object:
        const mergedActive: DisplayConnection = {
          ...active,
          // Attach pending doc references
          pendingDocId: pending.connectionDocId,
          pendingSenderSUUID: pending.senderSUUID,
          pendingLevelName,
        };
        result.push(mergedActive);

      } else if (active) {
        // only active doc => just display it as-is
        result.push(active);
      } else if (pending) {
        // only pending doc => display it normally
        result.push(pending);
      }
    }

    return result;
  }, [connections, connectionLevels]);

  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15;
  const containerStyle =
    displayConnections.length === 0
      ? [theme.centerContainer, { paddingBottom: bottomPadding }]
      : [theme.container, { paddingBottom: bottomPadding }];

  function handlePressConnection(connection: DisplayConnection) {
    setSelectedConnection(connection);
    setDetailsModalVisible(true);
  }

  // If still loading, show a quick spinner screen
  if (loading) {
    return (
      <View style={[theme.centerContainer]}>
        <Text style={theme.title}>Loading connections...</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={theme.title}>Your Connections</Text>

      <FlatList
        data={displayConnections}
        keyExtractor={(item) => item.connectionDocId || Math.random().toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handlePressConnection(item)}
          >
            <ConnectionItem connection={item} />
          </TouchableOpacity>
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshConnections}
            tintColor={theme.buttonPrimary.backgroundColor}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <Text style={theme.bodyText}>No connections found.</Text>
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
          // pass the item with potential pending data
          connection={selectedConnection}
          // If the user is the doc's recipient => isRecipient = true
          isRecipient={selectedConnection.recipientSUUID === mySUUID}
          mySUUID={mySUUID}
          stdis={stdis}
        />
      )}
    </View>
  );
}