// components/connections/ConnectionItem.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { useLookups } from '@/src/context/LookupContext';

export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;       
  connectionStatus: number;      
  senderSUUID: string;
  recipientSUUID: string;
  // Possibly references to the hidden pending doc
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingLevelName?: string;
}

interface ConnectionItemProps {
  connection: Connection;
}

export function ConnectionItem({ connection }: ConnectionItemProps) {
  const theme = useTheme();
  const { connectionLevels } = useLookups();

  const displayName = connection.displayName || 'Unknown';

  // For the doc's own level
  const lvlObj = connectionLevels[String(connection.connectionLevel)];
  const activeLevelName = lvlObj?.name ?? `Level ${connection.connectionLevel}`;

  let finalLevelText = activeLevelName;
  // If there's a hidden pending doc attached to it
  if (connection.pendingLevelName) {
    finalLevelText += ` (${connection.pendingLevelName} Request Pending)`;
  }

  return (
    <View style={styles.container}>
      {connection.imageUrl ? (
        <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholderAvatar} />
      )}

      <View style={styles.infoContainer}>
        <Text style={[theme.bodyText, styles.topLine]}>
          {displayName} (L{connection.connectionLevel}S{connection.connectionStatus})
        </Text>

        <Text style={[theme.bodyText, styles.expLine]}>
          {finalLevelText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  placeholderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    backgroundColor: '#ccc',
  },
  infoContainer: {
    flex: 1,
  },
  topLine: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  expLine: {
    fontSize: 14,
    opacity: 0.8,
  },
});