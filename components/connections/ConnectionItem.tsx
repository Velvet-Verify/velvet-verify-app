// components/connections/ConnectionItem.tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useTheme } from "styled-components/native";
import { Timestamp } from "firebase/firestore";

export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: any; // Firestore Timestamp or string
  expiresAt: any; // Firestore Timestamp or string
  updatedAt?: any; // Firestore Timestamp or string
  connectionLevel: number;
  connectionStatus: number; // 0 => purely pending doc, 1 => active, etc.
  senderSUUID: string;
  recipientSUUID: string;

  // If there's a merged pending doc:
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;

  hasPendingExposure?: boolean;
  exposureAlertType?: "iRequested" | "theyRequested" | "both";
}

interface ConnectionItemProps {
  connection: Connection;
  /** The viewer's SUUID, so we know if they're the pending doc sender. */
  mySUUID?: string;
}

/**
 * Combined logic, same as before, but now we incorporate `exposureAlertType`.
 *
 * 1) If `exposureAlertType==="iRequested"`, we show “Exposure Request Pending”
 *    on the second line (or “Request Sent”).
 * 2) If `exposureAlertType==="theyRequested"`, we show “They Requested Alerts” or “Incoming Request.”
 * 3) If purely pending connection doc => use your existing “Request Pending: level” logic.
 * 4) If active => second line is the date, etc.
 */
export function ConnectionItem({ connection, mySUUID }: ConnectionItemProps) {
  const theme = useTheme();
  const displayName = connection.displayName || "Unknown";

  // 1) Convert updatedAt to something like “Jan 23, 2025”
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

  let secondLine: string | null = null;
  let thirdLine: string | null = null;

  // Exposure Alerts scenario
  if (connection.hasPendingExposure && connection.exposureAlertType) {
    if (connection.exposureAlertType === "iRequested") {
      // I am the doc's "recipient" => I see "Request Pending"
      secondLine = "Exposure Request Pending";
    } else if (connection.exposureAlertType === "theyRequested") {
      secondLine = "Incoming Exposure Request";
    } else {
      // "both"
      secondLine = "Exposure Requests Pending (both ways)";
    }
    // If we show an exposure line, skip the rest
  } else {
    // Otherwise, do your normal logic with connectionStatus or merged doc
    const hasMergedPending =
      !!connection.pendingDocId && !!connection.pendingLevelName;

    // Decide which SUUID is the "pending doc" sender
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
    const pendingSender = getPendingSenderSUUID();
    const iAmPendingSender = mySUUID && pendingSender === mySUUID;
    const level = connection.pendingLevelName || "New"; // fallback if not specified

    if (hasMergedPending) {
      secondLine = iAmPendingSender
        ? `${level} Request Sent`
        : `Request Pending: ${level}`;
    } else if (connection.connectionStatus === 0) {
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
  }

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