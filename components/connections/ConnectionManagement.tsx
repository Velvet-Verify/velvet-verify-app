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
  const requestExposureAlertsCF = httpsCallable(functionsInstance, 'requestExposureAlerts');
  const computeHashedIdCF = httpsCallable(functionsInstance, 'computeHashedId'); // We'll use this to get ESUUID

  // We show a "Cancel X Request" button if there's a pending doc (merged or single)
  // AND the current user is that doc's sender
  const hasMergedPending = !!connection.pendingDocId;

  let isPendingSender = false;
  let docIdToCancel: string | undefined;
  let pendingLevelName: string | undefined;

  if (hasMergedPending) {
    // For the merged doc
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

  // If doc is active & level=2 => user can "Request Exposure Alerts"
  const meetsBaseExposureCondition =
    connection.connectionStatus === 1 && connection.connectionLevel === 2;

  // For the doc's own (active) level name
  const lvl = connectionLevels[String(connection.connectionLevel)];
  const activeLevelName = lvl?.name ?? `Level ${connection.connectionLevel}`;

  // We track whether there's a pending or active doc (in the last 48h)
  const [exposurePending, setExposurePending] = useState(false);
  const [exposureActive, setExposureActive] = useState(false);

  // On mount, check if there's any exposureAlert doc with:
  //   status in [0,1]
  //   recipient = mySUUID
  //   sender = either the other user's standard SUUID (for pending) or their ESUUID (for accepted)
  // and created in last 48h.
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

        // 1) Compute the exposure ESUUID for that user
        const result = await computeHashedIdCF({
          hashType: 'exposure',
          inputSUUID: otherSUUID, // we feed the standard SUUID in
        });
        const otherESUUID = result.data.hashedId as string;

        // We'll do a time cutoff: now - 48 hours
        const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;

        const alertsRef = collection(db, 'exposureAlerts');
        // Query for any doc where:
        //   sender is in [otherSUUID, otherESUUID],
        //   recipient = mySUUID,
        //   status in [0,1].
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

          // If you prefer ignoring time-based logic, remove this block
          if (createdTime < cutoffMs) {
            // older than 48h => skip
            return;
          }

          if (data.status === 0) {
            foundPending = true;
          } else if (data.status === 1) {
            foundActive = true;
          }

          // console.log('Found exposure alert doc:', docSnap.id, data);
        });

        setExposurePending(foundPending);
        setExposureActive(foundActive);
      } catch (err) {
        // console.error('Error checking exposure alerts (with ESUUID):', err);
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
        `${pendingLevelName || 'Connection'} request was cancelled.`
      );
      refreshConnections();
    } catch (err: any) {
      console.error('Error cancelling request:', err);
      Alert.alert('Error', err.message || 'Could not cancel request.');
    }
  }

  async function handleRequestExposure() {
    if (!connection.connectionDocId) return;
    try {
      await requestExposureAlertsCF({
        connectionDocId: connection.connectionDocId,
      });
      Alert.alert('Success', 'Exposure alert requests created!');
      // If you want to instantly reflect this in UI:
      setExposurePending(true);
    } catch (err: any) {
      console.error('Error requesting exposure alerts:', err);
      Alert.alert('Error', err.message || 'Failed to request alerts.');
    }
  }

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
              <ThemedButton
                title="Request Exposure Alerts"
                variant="primary"
                onPress={handleRequestExposure}
                style={styles.button}
              />
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