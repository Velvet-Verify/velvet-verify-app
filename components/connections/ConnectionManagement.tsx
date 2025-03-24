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
  isRecipient: boolean;
  mySUUID?: string;    // The current user's SUUID
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

  // We'll show "Cancel X Request" if we do indeed have a pending doc (either purely or merged)
  // AND the current user is the pending doc's sender.
  // For a merged doc => pendingDocId + pendingSenderSUUID
  // For a purely pending doc => connectionStatus=0 + this doc's senderSUUID
  const hasMergedPending = !!connection.pendingDocId; 

  let isPendingSender = false;
  let docIdToCancel: string | undefined;
  let pendingLevelName: string | undefined;

  if (hasMergedPending) {
    // The user is the pending doc's sender if connection.pendingSenderSUUID === mySUUID
    isPendingSender = (connection.pendingSenderSUUID === mySUUID);
    docIdToCancel = connection.pendingDocId;
    pendingLevelName = connection.pendingLevelName;
  } else if (connection.connectionStatus === 0) {
    // purely pending doc
    // The user is the sender if connection.senderSUUID === mySUUID
    isPendingSender = (connection.senderSUUID === mySUUID);
    docIdToCancel = connection.connectionDocId;
    // We'll fetch the doc's level name from lookups:
    const lvlObj = connectionLevels[String(connection.connectionLevel)];
    pendingLevelName = lvlObj?.name ?? `Level ${connection.connectionLevel}`;
  }

  const showCancel = (!!docIdToCancel) && isPendingSender;

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

  // For the doc's own (active) level name
  const lvl = connectionLevels[String(connection.connectionLevel)];
  const activeLevelName = lvl?.name ?? `Level ${connection.connectionLevel}`;

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