// app/(tabs)/connections.tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from 'styled-components/native';

import { NewConnection } from '@/components/ui/NewConnection';
import { ThemedButton } from '@/components/ui/ThemedButton';

export default function ConnectionsScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);
  const [showNewConnection, setShowNewConnection] = useState(false);

  useEffect(() => {
    async function loadConnections() {
      setLoading(true);

      // Simulate fetching connections from Firestore (empty array for now)
      const fetchedConnections: any[] = [];
      setConnections(fetchedConnections);
      setLoading(false);

      // If no connections are found, auto-open the New Connection modal
      if (fetchedConnections.length === 0) {
        setShowNewConnection(true);
      }
    }
    loadConnections();
  }, []);

  if (loading) {
    return (
      <View style={theme.centerContainer}>
        <Text style={theme.title}>Loading connections...</Text>
      </View>
    );
  }

  // When there are no connections, center the message and button
  if (connections.length === 0) {
    return (
      <View style={theme.centerContainer}>
        <Text style={theme.title}>No connections yet</Text>
        <ThemedButton
          title="New Connection"
          onPress={() => setShowNewConnection(true)}
        />
        <NewConnection
          visible={showNewConnection}
          onClose={() => setShowNewConnection(false)}
        />
      </View>
    );
  }

  // Future: when connections are available, list them in theme.container
  return (
    <View style={theme.container}>
      <Text style={theme.bodyText}>
        Here are your existing connections...
      </Text>
      <ThemedButton
        title="New Connection"
        onPress={() => setShowNewConnection(true)}
      />
      <NewConnection
        visible={showNewConnection}
        onClose={() => setShowNewConnection(false)}
      />
    </View>
  );
}
