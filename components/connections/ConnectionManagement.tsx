// components/connections/ConnectionManagement.tsx
import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { Connection } from './ConnectionDetailsModal'; 
// Or wherever your Connection interface is exported. 
// If it's in a separate file, import from that instead.

interface ConnectionManagementProps {
  connection: Connection;
  // Example placeholders for the 3 actions' callbacks:
  onChangeType?: () => void;
  onDisconnect?: () => void;
  onStartFling?: () => void;
}

/**
 * A simple component with 3 primary action buttons:
 * 1) Change Connection Type
 * 2) Disconnect
 * 3) Start a Fling
 */
export function ConnectionManagement({
  connection,
  onChangeType,
  onDisconnect,
  onStartFling,
}: ConnectionManagementProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Connection</Text>
      {/* Connection info can be displayed if you like */}
      <Text>Level: {connection.connectionLevel}</Text>
      <Text>Status: {connection.connectionStatus}</Text>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Button title="Change Connection Type" onPress={onChangeType} />
        <Button title="Disconnect" onPress={onDisconnect} />
        <Button title="Start a Fling" onPress={onStartFling} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 12,
    fontSize: 18,
  },
  buttonRow: {
    marginTop: 15,
    width: '80%',
    // space them out as you see fit
  },
});