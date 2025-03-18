import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Platform, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { useAuth } from "@/src/context/AuthContext";
import { useStdis } from "@/hooks/useStdis"; // For STDI definitions
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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConnectionModalVisible, setNewConnectionModalVisible] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [mySUUID, setMySUUID] = useState<string>("");

  const functionsInstance = getFunctions(firebaseApp);
  const getConnectionsCF = httpsCallable(functionsInstance, "getConnections");
  const computeHashedIdCF = httpsCallable(functionsInstance, "computeHashedId");
  const { user } = useAuth();
  const { stdis } = useStdis();

  // Compute the logged-in user's SUUID
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

  // Fetch connections
  useEffect(() => {
    async function fetchConnections() {
      try {
        const result = await getConnectionsCF({});
        // Assume result.data is an array of Connection objects (with senderSUUID and recipientSUUID)
        setConnections(result.data);
      } catch (error) {
        console.error("Error fetching connections:", error);
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      fetchConnections();
    }
  }, [user]);

  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15;
  const containerStyle =
    connections.length === 0
      ? [theme.centerContainer, { paddingBottom: bottomPadding }]
      : [theme.container, { paddingBottom: bottomPadding }];

  // When a connection is tapped, determine if you are the recipient by comparing your SUUID.
  function handlePressConnection(connection: Connection) {
    setSelectedConnection(connection);
    setDetailsModalVisible(true);
  }

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

      {connections.length === 0 ? (
        <Text style={theme.bodyText}>No connections found.</Text>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handlePressConnection(item)}
            >
              <ConnectionItem connection={item} />
            </TouchableOpacity>
          )}
        />
      )}

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
          isRecipient={mySUUID === selectedConnection.recipientSUUID}
          stdis={stdis}
        />
      )}
    </View>
  );
}