// components/connections/PendingElevation.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { useConnections } from '@/src/context/ConnectionsContext';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

export interface PendingElevationProps {
  /** The active doc’s ID */
  baseDocId: string;
  /** The docId for the pending doc that is requesting elevation */
  pendingDocId: string;
  /** e.g. "Friend" or "Bond" */
  pendingLevelName: string;
  /** Optionally, the ID used to fetch the level description from Firestore */
  pendingLevelId?: number;
  /** Called when the user finishes (accept/decline) so we can close the modal, etc. */
  onClose: () => void;
}

/**
 * Displays a message about the pending elevation request along with
 * Accept and Decline buttons that are centered.
 */
export function PendingElevation({
  baseDocId,
  pendingDocId,
  pendingLevelName,
  pendingLevelId,
  onClose,
}: PendingElevationProps) {
  const theme = useTheme();
  const db = getFirestore(firebaseApp);
  const { refreshConnections } = useConnections();
  const functionsInstance = getFunctions(firebaseApp);
  const updateConnectionStatusCF = httpsCallable(functionsInstance, 'updateConnectionStatus');

  // Optional: fetch level description from Firestore if pendingLevelId is provided
  const [description, setDescription] = useState<string>("");
  useEffect(() => {
    if (!pendingLevelId) return;
    (async () => {
      try {
        const docRef = doc(db, 'connectionLevels', String(pendingLevelId));
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setDescription(snap.data()?.description || "");
        }
      } catch (err) {
        console.warn("Failed to load pending level description:", err);
      }
    })();
  }, [pendingLevelId, db]);

  async function handleAccept() {
    try {
      // Mark the pending doc as active and the base doc as deactivated
      await updateConnectionStatusCF({ docId: pendingDocId, newStatus: 1 });
      // await updateConnectionStatusCF({ docId: baseDocId, newStatus: 4 });
      Alert.alert("Accepted", `Elevated to ${pendingLevelName}.`);
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error("Error accepting elevation:", err);
      Alert.alert("Error", err.message || "Could not accept elevation.");
    }
  }

  async function handleDecline() {
    try {
      // Mark the pending doc as rejected (status=2)
      await updateConnectionStatusCF({ docId: pendingDocId, newStatus: 2 });
      Alert.alert("Declined", `You have declined the ${pendingLevelName} request.`);
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error("Error declining elevation:", err);
      Alert.alert("Error", err.message || "Could not decline elevation.");
    }
  }

  return (
    <View style={[theme.centerContainer, styles.container]}>
      <Text style={[theme.title, { marginBottom: 15 }]}>
        {pendingLevelName} Request
      </Text>

      {!!description && (
        <Text style={[theme.bodyText, { marginBottom: 15 }]}>
          {description}
        </Text>
      )}

      <View style={styles.buttonRow}>
        <View style={styles.buttonWrapper}>
          <Button
            title="Decline"
            onPress={handleDecline}
            color={theme.buttonSecondary.backgroundColor}
          />
        </View>
        <View style={styles.buttonWrapper}>
          <Button
            title="Accept"
            onPress={handleAccept}
            color={theme.buttonPrimary.backgroundColor}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center', 
    alignItems: 'center',
  },
  buttonWrapper: {
    marginHorizontal: 10,
  },
});