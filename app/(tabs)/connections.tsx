// app/(tabs)/connections.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Platform, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { useAuth } from "@/src/context/AuthContext";
import { ThemedButton } from "@/components/ui/ThemedButton";
import { NewConnection } from "@/components/connections/NewConnection";
import { ConnectionDetailsModal } from "@/components/connections/ConnectionDetailsModal";
import { ConnectionItem, Connection } from "@/components/connections/ConnectionItem";

export default function ConnectionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConnectionModalVisible, setNewConnectionModalVisible] = useState(false);

  // State for the Connection Details Modal
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const functionsInstance = getFunctions(firebaseApp);
  const getConnectionsCF = httpsCallable(functionsInstance, "getConnections");
  const { user } = useAuth();

  /** Re-fetch or refresh the connections from Firestore/CF */
  async function refreshConnections() {
    try {
      setLoading(true);
      const result = await getConnectionsCF({});
      if (Array.isArray(result.data)) {
        setConnections(result.data);
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      refreshConnections();
    }
  }, [user]);

  // Conditionally apply bottom padding only on iOS, so the button appears above the floating tab bar
  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15;

  const containerStyle =
    connections.length === 0
      ? [theme.centerContainer, { paddingBottom: bottomPadding }]
      : [theme.container, { paddingBottom: bottomPadding }];

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
            <TouchableOpacity activeOpacity={0.7} onPress={() => handlePressConnection(item)}>
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
          isRecipient={selectedConnection.connectionStatus === 0}
          /**
           * Pass the refresh callback here:
           * We'll call it in the modal once accept/reject is done.
           */
          onStatusUpdated={refreshConnections}
        />
      )}
    </View>
  );
}
