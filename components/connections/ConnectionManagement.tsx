// components/connections/ConnectionManagement.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { Connection } from './ConnectionDetailsModal';
import { useConnections } from '@/src/context/ConnectionsContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { useLookups } from '@/src/context/LookupContext';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

interface ConnectionManagementProps {
  connection: Connection;
  isRecipient: boolean;
  mySUUID?: string; // The current user's SUUID
  onChangeType?: () => void;
  onDisconnect?: () => void;
}

/**
 * Manages a connection with:
 * - Cancel request (if pending & I'm sender)
 * - Change type (if active)
 * - Disconnect
 * - Checking if exposure is pending/active (shown as text only).
 * 
 * Removed only the "Request Exposure Alerts" button + function.
 */
export function ConnectionManagement({
  connection,
  isRecipient,
  mySUUID,
  onChangeType,
  onDisconnect,
}: ConnectionManagementProps) {
  const theme = useTheme();
  const db = getFirestore(firebaseApp);
  const { refreshConnections } = useConnections();
  const { connectionLevels } = useLookups();

  const functionsInstance = getFunctions(firebaseApp);
  const updateConnectionStatusCF = httpsCallable(functionsInstance, 'updateConnectionStatus');
  const computeHashedIdCF = httpsCallable(functionsInstance, 'computeHashedId');

  // We used to import requestExposureAlertsCF here. Now removed.

  // Checking if there's a "merged" pending doc:
  const hasMergedPending = !!connection.pendingDocId;

  let isPendingSender = false;
  let docIdToCancel: string | undefined;
  let pendingLevelName: string | undefined;

  if (hasMergedPending) {
    // For merged doc
    isPendingSender = connection.pendingSenderSUUID === mySUUID;
    docIdToCancel = connection.pendingDocId;
    pendingLevelName = connection.pendingLevelName;
  } else if (connection.connectionStatus === 0) {
    // purely pending doc
    isPendingSender = connection.senderSUUID === mySUUID;
    docIdToCancel = connection.connectionDocId;
    const lvlObj = connectionLevels[String(connection.connectionLevel)];
    pendingLevelName = lvlObj?.name ?? `Level ${connection.connectionLevel}`;
  }

  const showCancel = !!docIdToCancel && isPendingSender;

  // If doc is active & level=2 => we previously had "Request Exposure" button,
  // now removed. We'll keep the logic to see if there's a pending or active exposure, 
  // so the user can see the text about it.
  const meetsBaseExposureCondition =
    connection.connectionStatus === 1 && connection.connectionLevel === 2;

  // For the doc's own (active) level name
  const lvl = connectionLevels[String(connection.connectionLevel)];
  const activeLevelName = lvl?.name ?? `Level ${connection.connectionLevel}`;

  // Expose local states for whether there's a pending or active doc in last 48h
  const [exposurePending, setExposurePending] = useState(false);
  const [exposureActive, setExposureActive] = useState(false);

  useEffect(() => {
    if (!mySUUID || !meetsBaseExposureCondition) {
      return;
    }

    async function checkAlerts() {
      try {
        // Identify the other user’s standard SUUID
        const otherSUUID =
          connection.senderSUUID === mySUUID
            ? connection.recipientSUUID
            : connection.senderSUUID;

        // 1) Compute the exposure ESUUID for the other user
        const result = await computeHashedIdCF({
          hashType: 'exposure',
          inputSUUID: otherSUUID,
        });
        const otherESUUID = result.data.hashedId as string;

        // We'll do a time cutoff: now - 48 hours
        const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;

        const alertsRef = collection(db, 'exposureAlerts');
        // Check for docs where:
        //   sender in [otherSUUID, otherESUUID]
        //   recipient=mySUUID
        //   status in [0=Pending, 1=Accepted]
        const q = query(
          alertsRef,
          where('sender', 'in', [otherSUUID, otherESUUID]),
          where('recipient', '==', mySUUID),
          where('status', 'in', [0, 1])
        );

        const snap = await getDocs(q);
        if (snap.empty) {
          setExposurePending(false);
          setExposureActive(false);
          return;
        }

        let foundPending = false;
        let foundActive = false;

        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (typeof data.status !== 'number') return;
          if (!data.createdAt) return;

          let createdTime = 0;
          if (data.createdAt instanceof Timestamp) {
            createdTime = data.createdAt.toMillis();
          } else if (data.createdAt.seconds) {
            createdTime = data.createdAt.seconds * 1000;
          } else {
            const dt = new Date(data.createdAt).getTime();
            if (!isNaN(dt)) {
              createdTime = dt;
            }
          }

          // If older than 48h => skip
          if (createdTime < cutoffMs) return;

          if (data.status === 0) foundPending = true;
          if (data.status === 1) foundActive = true;
        });

        setExposurePending(foundPending);
        setExposureActive(foundActive);
      } catch (err) {
        // Optionally log or ignore
      }
    }

    checkAlerts();
  }, [mySUUID, meetsBaseExposureCondition, connection, db, computeHashedIdCF]);

  async function handleCancelRequest() {
    if (!docIdToCancel) return;
    try {
      await updateConnectionStatusCF({ docId: docIdToCancel, newStatus: 5 });
      Alert.alert(
        'Cancelled',
        `${pendingLevelName || activeLevelName} request was cancelled.`
      );
      refreshConnections();
    } catch (err: any) {
      console.error('Error cancelling request:', err);
      Alert.alert('Error', err.message || 'Could not cancel request.');
    }
  }

  // The old handleRequestExposure & requestExposureAlertsCF import are removed.

  return (
    <View style={[theme.centerContainer, styles.container]}>
      <Text style={[theme.title, styles.title]}>Manage Connection</Text>

      <View style={styles.buttonContainer}>
        {showCancel ? (
          <ThemedButton
            title={`Cancel ${pendingLevelName || activeLevelName} Request`}
            variant="primary"
            onPress={handleCancelRequest}
            style={styles.button}
          />
        ) : (
          <ThemedButton
            title="Change Connection Type"
            variant="primary"
            onPress={onChangeType}
            style={styles.button}
          />
        )}

        <ThemedButton
          title="Disconnect"
          variant="primary"
          onPress={onDisconnect}
          style={styles.button}
        />

        {/* We used to show a "Request Exposure Alerts" button here, 
            replaced with read-only status text for your convenience. */}
        {meetsBaseExposureCondition && (
          <>
            {exposureActive ? (
              <Text style={[theme.bodyText, { marginTop: 10 }]}>
                Exposure Alerts Active
              </Text>
            ) : exposurePending ? (
              <Text style={[theme.bodyText, { marginTop: 10 }]}>
                Request for Exposure Alerts Pending
              </Text>
            ) : (
              // No button: just no content if neither is true.
              null
            )}
          </>
        )}
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
    height: 50,
    width: '100%',
  },
});