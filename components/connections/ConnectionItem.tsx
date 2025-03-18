// components/connections/ConnectionItem.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';

export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;      // We won't display CreatedAt in the new layout
  expiresAt: string | null;      // We'll only show the date
  connectionLevel: number;       // L#
  connectionStatus: number;      // S#
}

interface ConnectionItemProps {
  connection: Connection;
}

/**
 * Renders a single connection row:
 * [ avatar ] [ username (L#S#)   ]
 *            [ expiresAt (date) ]
 */
export function ConnectionItem({ connection }: ConnectionItemProps) {
  const theme = useTheme();

  // Format the expiration date as just the date part:
  const expiresDate = connection.expiresAt
    ? new Date(connection.expiresAt).toLocaleDateString()
    : 'N/A';

  const displayName = connection.displayName || 'Unknown';

  return (
    <View style={styles.container}>
      {/* Avatar/Img on the left */}
      {connection.imageUrl ? (
        <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholderAvatar} />
      )}

      {/* Text block to the right */}
      <View style={styles.infoContainer}>
        {/* First line: displayName plus (L#S#) */}
        <Text style={[theme.bodyText, styles.topLine]}>
          {displayName} (L{connection.connectionLevel}S{connection.connectionStatus})
        </Text>

        {/* Second line: Expiration date only */}
        {connection.connectionLevel === 2 && (
          <Text style={[theme.bodyText, styles.expLine]}>
            Expires: {expiresDate}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',   // Place avatar and text horizontally
    alignItems: 'center',   // Vertically center them
    marginVertical: 8,
    // no border
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
