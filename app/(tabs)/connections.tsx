// app/(tabs)/connections.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Image } from "react-native";
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { useAuth } from "@/src/context/AuthContext";
import { ThemedButton } from "@/components/ui/ThemedButton";

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
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <View style={theme.centerContainer}>
        <Text style={theme.title}>Loading connections...</Text>
      </View>
    );
  }

  return (
    <View style={theme.container}>
      <Text style={theme.title}>Your Connections</Text>
      {connections.length === 0 ? (
        <Text style={theme.bodyText}>No connections found.</Text>
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <View
              style={{
                marginVertical: 8,
                padding: 8,
                borderWidth: 1,
                borderColor: theme.input.borderColor,
                borderRadius: 4,
              }}
            >
              <Text style={theme.bodyText}>
                From: {item.displayName || "Unknown"}
              </Text>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: 50, height: 50, borderRadius: 25 }}
                />
              ) : null}
              <Text style={theme.bodyText}>
                Created:{" "}
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : "N/A"}
              </Text>
              <Text style={theme.bodyText}>
                Expires:{" "}
                {item.expiresAt
                  ? new Date(item.expiresAt).toLocaleString()
                  : "N/A"}
              </Text>
              <Text style={theme.bodyText}>
                Level: {item.connectionLevel}
              </Text>
              <Text style={theme.bodyText}>
                Status: {item.connectionStatus}
              </Text>
            </View>
          )}
        />
      )}
      <ThemedButton
        title="Refresh"
        variant="primary"
        onPress={async () => {
          setLoading(true);
          try {
            const result = await getConnectionsCF({});
            setConnections(result.data);
          } catch (error) {
            console.error("Error refreshing connections:", error);
          } finally {
            setLoading(false);
          }
        }}
      />
    </View>
  );
}
