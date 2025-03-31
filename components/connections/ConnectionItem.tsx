// components/connections/ConnectionItem.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';

export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
  senderSUUID: string;
  recipientSUUID: string;
  // Possibly references to a pending doc
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
}

interface ConnectionItemProps {
  connection: Connection;
}

/**
 * Renders a connection item:
 * - Avatar + display name
 * - If there's a pendingLevelName, we show "Request Pending: <pendingLevelName>"
 */
export function ConnectionItem({ connection }: ConnectionItemProps) {
  const theme = useTheme();

  const displayName = connection.displayName || 'Unknown';

  // If there's a hidden pending doc attached to it:
  // e.g. "Request Pending: Friend"
  const pendingText = connection.pendingLevelName
    ? `Request Pending: ${connection.pendingLevelName}`
    : null;

  return (
    <View style={styles.container}>
      {/* Avatar */}
      {connection.imageUrl ? (
        <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholderAvatar} />
      )}

      {/* Texts */}
      <View style={styles.infoContainer}>
        {/* Display Name */}
        <Text style={[theme.bodyText, styles.topLine]}>
          {displayName}
        </Text>

        {/* If there's a pending request, display a second line */}
        {pendingText && (
          <Text style={[theme.bodyText, styles.pendingText]}>
            {pendingText}
          </Text>
        )}
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
  pendingText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
});