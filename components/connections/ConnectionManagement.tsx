// components/connections/ConnectionManagement.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { Connection } from './ConnectionDetailsModal';

interface ConnectionManagementProps {
  connection: Connection;
  onChangeType?: () => void;
  onDisconnect?: () => void;
  onStartFling?: () => void;
}

/**
 * A simple component with 3 primary action buttons (stacked vertically):
 * 1. Change Connection Type
 * 2. Disconnect
 * 3. Start a Fling
 */
export function ConnectionManagement({
  connection,
  onChangeType,
  onDisconnect,
  onStartFling,
}: ConnectionManagementProps) {
  const theme = useTheme();

  return (
    <View style={[theme.centerContainer, styles.container]}>
      <Text style={[theme.title, styles.title]}>Manage Connection</Text>
      <Text style={theme.bodyText}>Level: {connection.connectionLevel}</Text>
      <Text style={theme.bodyText}>Status: {connection.connectionStatus}</Text>

      <View style={styles.buttonContainer}>
        <ThemedButton
          title="Change Connection Type"
          variant="primary"
          onPress={onChangeType}
          style={styles.button}
        />
        <ThemedButton
          title="Disconnect"
          variant="primary"
          onPress={onDisconnect}
          style={styles.button}
        />
        <ThemedButton
          title="Start a Fling"
          variant="primary"
          onPress={onStartFling}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    marginBottom: 10,
  },
  buttonContainer: {
    marginTop: 20,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  button: {
    marginVertical: 5,
    // Ensures all buttons have the same size. Adjust as needed.
    height: 50,
    width: '100%',
  },
});