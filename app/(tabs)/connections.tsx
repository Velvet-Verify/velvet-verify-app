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
 * For merging, we store info about a second doc:
 * pendingDocId, pendingSenderSUUID, pendingRecipientSUUID, pendingLevelName
 */
interface DisplayConnection extends Connection {
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
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
    function getPairKey(c: Connection) {
      const pair = [c.senderSUUID, c.recipientSUUID].sort();
      return pair.join("_");
    }

    const pairMap = new Map<string, { active?: Connection; pending?: Connection }>();

    for (const c of connections) {
      // Skip docs with status=2 (rejected), 5 (cancelled), etc. 
      // We only want to show active(1) or pending(0).
      if (![0, 1].includes(c.connectionStatus)) {
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
        // Both an active doc & a pending doc
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