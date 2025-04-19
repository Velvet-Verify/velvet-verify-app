// components/connections/ConnectionItem.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { Timestamp } from 'firebase/firestore';

/* ------------- types ------------- */
export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: any;
  updatedAt?: any;
  connectionLevel: number;
  connectionStatus: number; // 0=pending, 1=active

  senderSUUID: string;
  recipientSUUID: string;

  /* merged‑doc extras (for pending‑elevation) */
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
  pendingLevelId?: number;
}

interface Props {
  connection: Connection;  // actually DisplayConnection from the screen
  mySUUID?: string;
}

/* ------------- component ---------- */
export function ConnectionItem({ connection, mySUUID }: Props) {
  const theme = useTheme();
  const displayName = connection.displayName || 'Unknown';

  /* helper: build a nice date string */
  function formatDisplayDate(val: any): string | null {
    if (!val) return null;
    let d: Date | null = null;

    if (val instanceof Timestamp) d = val.toDate();
    else if (typeof val === 'object' && typeof val.seconds === 'number')
      d = new Date(val.seconds * 1000);
    else if (typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) d = parsed;
    }

    if (!d) return null;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /* -------- secondary line logic -------- */
  let subtitle: string | null = null;

  // Case 1: I'm the recipient of a pending‑elevation request
  if (connection.pendingDocId) {
    if (connection.pendingRecipientSUUID === mySUUID) {
      subtitle = 'Pending Request';                 // they’re waiting on me
    } else if (connection.pendingSenderSUUID === mySUUID) {
      subtitle = 'Elevation Request Sent';          // I’m waiting on them
    }
  }
  // Case 2: regular active connection → show last‑updated date
  else if (
    connection.connectionStatus <= 1 &&
    connection.updatedAt
  ) {
    subtitle = formatDisplayDate(connection.updatedAt);
  }
  // otherwise leave subtitle null

  /* -------- render -------- */
  return (
    <View style={styles.container}>
      {connection.imageUrl ? (
        <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholderAvatar} />
      )}

      <View style={styles.infoContainer}>
        <Text style={[theme.bodyText, styles.topLine]}>{displayName}</Text>

        {subtitle && (
          <Text style={[theme.bodyText, styles.secondaryLine]}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
}

/* ------------- styles ------------- */
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
  secondaryLine: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
});