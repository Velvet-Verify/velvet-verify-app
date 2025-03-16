// app/(tabs)/connections.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { useAuth } from "@/src/context/AuthContext";
import { ThemedButton } from "@/components/ui/ThemedButton";
import { NewConnection } from "@/components/connections/NewConnection";
import { ConnectionItem, Connection } from "@/components/connections/ConnectionItem";

interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
}

export default function ConnectionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConnectionModalVisible, setNewConnectionModalVisible] = useState(false);

  const functionsInstance = getFunctions(firebaseApp);
  const getConnectionsCF = httpsCallable(functionsInstance, "getConnections");
  const { user } = useAuth();

  useEffect(() => {
    async function fetchConnections() {
      try {
        const result = await getConnectionsCF({});
        // Assume result.data is an array of Connection objects.
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

  // Conditionally apply bottom padding only on iOS, so the button appears above the "floating" tab bar.
  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15; 
  // ↑ Adjust the +60 as desired to push the button higher/lower on iOS

  // For the main container, just use your theme container + conditional bottom padding
  const containerStyle = connections.length === 0
    ? [
        theme.centerContainer,
        { paddingBottom: bottomPadding }
      ]
    : [
        theme.container,
        { paddingBottom: bottomPadding }
      ];

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
          renderItem={({ item }) => <ConnectionItem connection={item} />}
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
    </View>
  );
}
