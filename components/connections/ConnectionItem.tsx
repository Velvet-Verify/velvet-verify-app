import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useTheme } from "styled-components/native";
import { Timestamp } from "firebase/firestore";

export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: any; 
  updatedAt?: any; 
  expiresAt?: any; 
  connectionLevel: number;
  connectionStatus: number; 
  senderSUUID: string;
  recipientSUUID: string;

  // Merged doc fields:
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
  pendingLevelId?: number;

  hasPendingExposure?: boolean;
  /**
   * - "theyRequested" => doc with (sender=other, recipient=me, status=0)
   * - "iRequested" => doc with (sender=me, recipient=other, status=0)
   * - "both" => both directions
   */
  exposureAlertType?: "iRequested" | "theyRequested" | "both";
}

interface ConnectionItemProps {
  connection: Connection;
  mySUUID?: string;
}

export function ConnectionItem({ connection, mySUUID }: ConnectionItemProps) {
  const theme = useTheme();
  const displayName = connection.displayName || "Unknown";

  function formatDisplayDate(val: any): string | null {
    if (!val) return null;
    let dateObj: Date | null = null;
    if (val instanceof Timestamp) {
      dateObj = val.toDate();
    } else if (typeof val === "object" && typeof val.seconds === "number") {
      dateObj = new Date(val.seconds * 1000);
    } else if (typeof val === "string") {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
    if (!dateObj) return null;
    return dateObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  const displayDate = formatDisplayDate(connection.updatedAt);

  /** If item requires my action => "Awaiting your response" */
  function requiresAction() {
    // If exposure => "theyRequested" or "both" => I'm the recipient
    if (
      connection.exposureAlertType === "theyRequested" ||
      connection.exposureAlertType === "both"
    ) {
      return true;
    }
    // If purely pending connection doc => check if I'm the recipient
    if (
      connection.connectionStatus === 0 &&
      connection.recipientSUUID === mySUUID
    ) {
      return true;
    }
    return false;
  }

  let secondLine: string | null = null;
  if (requiresAction()) {
    secondLine = "Awaiting your response";
  } else {
    // If active, maybe show the last updated date
    if (connection.connectionStatus === 1 && displayDate) {
      secondLine = displayDate;
    }
  }

  return (
    <View style={styles.container}>
      {connection.imageUrl ? (
        <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.placeholderAvatar} />
      )}

      <View style={styles.infoContainer}>
        <Text style={[theme.bodyText, styles.topLine]}>{displayName}</Text>

        {secondLine && (
          <Text style={[theme.bodyText, styles.secondaryLine]}>
            {secondLine}
          </Text>
        )}
      </View>
    </View>
  );
}

// styles
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: "#ccc",
  },
  infoContainer: {
    flex: 1,
  },
  topLine: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  secondaryLine: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
});