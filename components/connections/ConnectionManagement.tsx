import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { Connection } from './ConnectionDetailsModal';
import { useConnections } from '@/src/context/ConnectionsContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { useLookups } from '@/src/context/LookupContext';

interface ConnectionManagementProps {
  connection: Connection;
  // If true => user is the doc's recipient
  isRecipient: boolean;
  // The user’s SUUID, so we can see if they are the pending doc's sender
  mySUUID?: string;
  onChangeType?: () => void;
  onDisconnect?: () => void;
  onStartFling?: () => void;
}

export function ConnectionManagement({
  connection,
  isRecipient,
  mySUUID,
  onChangeType,
  onDisconnect,
  onStartFling,
}: ConnectionManagementProps) {
  const theme = useTheme();
  const { refreshConnections } = useConnections();
  const { connectionLevels } = useLookups();

  const functionsInstance = getFunctions(firebaseApp);
  const updateConnectionStatusCF = httpsCallable(functionsInstance, 'updateConnectionStatus');

  const hasPendingDoc = !!connection.pendingDocId;

  // Decide if current user is the actual sender of the pending doc
  // We'll compare pendingSenderSUUID to mySUUID if it's merged,
  // or if it's a purely pending doc, compare c.senderSUUID to mySUUID:
  let isPendingSender = false;
  if (hasPendingDoc) {
    // merged doc => we have connection.pendingSenderSUUID
    isPendingSender = (connection.pendingSenderSUUID === mySUUID);
  } else if (connection.connectionStatus === 0) {
    // purely pending doc => check if user is the doc's sender
    isPendingSender = (connection.senderSUUID === mySUUID);
  }

  const showCancel = hasPendingDoc || connection.connectionStatus === 0
    ? isPendingSender
    : false;

  async function handleCancelRequest() {
    const docIdToCancel = connection.pendingDocId || connection.connectionDocId;
    if (!docIdToCancel) return;

    try {
      await updateConnectionStatusCF({ docId: docIdToCancel, newStatus: 5 });
      Alert.alert(
        'Cancelled',
        `${connection.pendingLevelName || 'Connection'} request was cancelled.`
      );
      refreshConnections();
    } catch (err: any) {
      console.error('Error cancelling request:', err);
      Alert.alert('Error', err.message || 'Could not cancel request.');
    }
  }

  const lvlInfo = connectionLevels[String(connection.connectionLevel)];
  const activeLevelName = lvlInfo?.name ?? `Level ${connection.connectionLevel}`;

  return (
    <View style={[theme.centerContainer, styles.container]}>
      <Text style={[theme.title, styles.title]}>Manage Connection</Text>

      <View style={styles.buttonContainer}>
        {showCancel ? (
          <ThemedButton
            title={`Cancel ${connection.pendingLevelName || activeLevelName} Request`}
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
        <ThemedButton
          title="Start a Fling"
          variant="primary"
          onPress={onStartFling}
          style={styles.button}
        />
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