// components/connections/ConnectionItem.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { Timestamp } from 'firebase/firestore';

export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: any;        // Firestore Timestamp or string
  expiresAt: any;        // Firestore Timestamp or string
  updatedAt?: any;       // Firestore Timestamp or string
  connectionLevel: number;
  connectionStatus: number;  // 0 => purely pending doc, 1 => active, etc.
  senderSUUID: string;       // used if purely pending or active
  recipientSUUID: string;

  // If there's a merged pending doc:
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
}

interface ConnectionItemProps {
  connection: Connection;
  /** The viewer's SUUID, so we know if they're the pending doc sender. */
  mySUUID?: string;
}

/**
 * Combined logic:
 * 1) If there's a merged pending doc => 
 *    - second line shows "Request Sent" if mySUUID === pendingSenderSUUID, else "Request Pending: <pendingLevel>"
 *    - skip the date line
 * 2) If purely pending (connectionStatus=0, no pendingDocId):
 *    - second line shows "Request Sent" if mySUUID === senderSUUID, else "Request Pending: <level>"
 *    - third line = date (if updatedAt is present)
 * 3) If active (connectionStatus=1) w/ no merged pending => second line is the date (if updatedAt).
 */
export function ConnectionItem({ connection, mySUUID }: ConnectionItemProps) {
  const theme = useTheme();
  const displayName = connection.displayName || 'Unknown';

  // 1) Check if we have a merged doc
  const hasMergedPending = !!connection.pendingDocId && !!connection.pendingLevelName;

  // 2) Decide which SUUID is the "pending doc" sender
  function getPendingSenderSUUID(): string | null {
    if (hasMergedPending && connection.pendingSenderSUUID) {
      return connection.pendingSenderSUUID;
    }
    if (!hasMergedPending && connection.connectionStatus === 0) {
      // purely pending => top-level doc
      return connection.senderSUUID;
    }
    return null;
  }

  // 3) Convert updatedAt to “Jan 23, 2025” if valid
  function formatDisplayDate(val: any): string | null {
    if (!val) return null;

    let dateObj: Date | null = null;
    if (val instanceof Timestamp) {
      dateObj = val.toDate();
    } else if (typeof val === 'object' && typeof val.seconds === 'number') {
      dateObj = new Date(val.seconds * 1000);
    } else if (typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }

    if (!dateObj) return null;
    return dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  const displayDate = formatDisplayDate(connection.updatedAt);

  // 4) Build the lines
  let secondLine: string | null = null;
  let thirdLine: string | null = null;

  const pendingSender = getPendingSenderSUUID();
  const iAmPendingSender = mySUUID && pendingSender === mySUUID;
  const level = connection.pendingLevelName || 'New'; // fallback if not specified

  if (hasMergedPending) {
    // Merged doc => active + pending request
    // => second line is "Request Sent" or "Request Pending: <level>"
    // => skip date entirely
    secondLine = iAmPendingSender
      ? `${level} Request Sent`
      : `Request Pending: ${level}`;
  } else if (connection.connectionStatus === 0) {
    // purely pending => second line is pending text, third line is date
    secondLine = iAmPendingSender
      ? `${level} Request Sent`
      : `Request Pending: ${level}`;

    if (displayDate) {
      thirdLine = displayDate;
    }
  } else if (connection.connectionStatus === 1) {
    // active => second line is date if present
    if (displayDate) {
      secondLine = displayDate;
    }
  }
  // else, if status=4 or etc., you can handle as needed

  return (
    <View style={styles.container}>
      {connection.imageUrl ? (
        <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholderAvatar} />
      )}

      <View style={styles.infoContainer}>
        {/* 1) Name in bold */}
        <Text style={[theme.bodyText, styles.topLine]}>{displayName}</Text>

        {/* 2) Possibly a second line */}
        {secondLine && (
          <Text style={[theme.bodyText, styles.secondaryLine]}>
            {secondLine}
          </Text>
        )}

        {/* 3) Possibly a third line (for purely pending doc date) */}
        {thirdLine && (
          <Text style={[theme.bodyText, styles.secondaryLine]}>
            {thirdLine}
          </Text>
        )}
      </View>
    </View>
  );
}

// styles

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