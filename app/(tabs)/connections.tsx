// app/(tabs)/connections.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnections } from '@/src/context/ConnectionsContext'; 
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { useAuth } from "@/src/context/AuthContext";
import { useStdis } from "@/hooks/useStdis";
import { ThemedButton } from "@/components/ui/ThemedButton";
import { NewConnection } from "@/components/connections/NewConnection";
import { ConnectionDetailsModal } from "@/components/connections/ConnectionDetailsModal";
import { ConnectionItem } from "@/components/connections/ConnectionItem";

export interface Connection {
  connectionDocId?: string;    
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;     
  connectionStatus: number;
  senderSUUID: string;
  recipientSUUID: string;
}

export default function ConnectionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Use the connections context for data
  const { connections, loading, refreshConnections } = useConnections();

  const [newConnectionModalVisible, setNewConnectionModalVisible] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [mySUUID, setMySUUID] = useState<string>("");

  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, "computeHashedId");
  const { user } = useAuth();
  const { stdis } = useStdis();

  // 1) Compute the logged-in user's SUUID
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

  // Keep your existing container style logic
  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15;
  const containerStyle =
    connections.length === 0
      ? [theme.centerContainer, { paddingBottom: bottomPadding }]
      : [theme.container, { paddingBottom: bottomPadding }];

  // 2) When tapped, open the ConnectionDetailsModal with the selected connection
  function handlePressConnection(connection: Connection) {
    setSelectedConnection(connection);
    setDetailsModalVisible(true);
  }

  // 3) If loading, show a quick loading view
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

      {/*
        Instead of an `if (connections.length === 0)`, we always render `FlatList`.
        We attach a `ListEmptyComponent` to show "No connections found." (and possibly
        the "New Connection" button) when the array is empty.

        This ensures the RefreshControl is always present — letting the user pull to refresh
        even when there are zero connections.
      */}
      <FlatList
        data={connections}
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
        // If empty, show your "No connections found." text
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <Text style={theme.bodyText}>No connections found.</Text>
          </View>
        }
      />

      {/* Keep your separate "New Connection" button (or embed it in ListEmptyComponent if you prefer) */}
      <ThemedButton
        title="New Connection"
        variant="primary"
        onPress={() => setNewConnectionModalVisible(true)}
      />

      {/* The rest remains the same */}
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
          isRecipient={mySUUID === selectedConnection.recipientSUUID}
          stdis={stdis}
        />
      )}
    </View>
  );
}