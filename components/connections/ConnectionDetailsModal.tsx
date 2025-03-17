// components/connections/ConnectionDetailsModal.tsx
import React from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { useLookups } from '@/src/context/LookupContext';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

const functionsInstance = getFunctions(firebaseApp);
const updateConnectionStatusCF = httpsCallable(functionsInstance, "updateConnectionStatus");

export interface Connection {
  connectionDocId: string; // from the getConnections CF
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
}

interface ConnectionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  connection: Connection;
  isRecipient: boolean;
  /** Called after we successfully accept/reject a connection, so the parent screen can refresh. */
  onStatusUpdated?: () => void;
}

export function ConnectionDetailsModal({
  visible,
  onClose,
  connection,
  isRecipient,
  onStatusUpdated,
}: ConnectionDetailsModalProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const { connectionLevels, connectionStatuses } = useLookups();

  const lvlDoc = connectionLevels[String(connection.connectionLevel)];
  const statusDoc = connectionStatuses[String(connection.connectionStatus)];

  const levelName = lvlDoc?.name ?? `Level ${connection.connectionLevel}`;
  const levelDescription = lvlDoc?.description ?? '';
  const statusName = statusDoc?.name ?? `Status ${connection.connectionStatus}`;

  // If connectionStatus=0 && connectionLevel=2 && user is recipient => show accept/reject
  const isPendingNew =
    connection.connectionStatus === 0 &&
    connection.connectionLevel === 2 &&
    isRecipient;

  async function handleAccept() {
    try {
      await updateConnectionStatusCF({
        connectionDocId: connection.connectionDocId,
        newStatus: 1, // 1 => Accept
      });
      Alert.alert('Connection updated', 'Status changed to Accepted (1).');

      // Refresh the parent screen so it sees the new status
      if (onStatusUpdated) {
        onStatusUpdated();
      }
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept connection.');
    }
  }

  async function handleReject() {
    try {
      await updateConnectionStatusCF({
        connectionDocId: connection.connectionDocId,
        newStatus: 2, // 2 => Reject
      });
      Alert.alert('Connection updated', 'Status changed to Rejected (2).');

      // Refresh the parent screen so it sees the new status
      if (onStatusUpdated) {
        onStatusUpdated();
      }
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject connection.');
    }
  }

  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      <ProfileHeader
        displayName={connection.displayName || 'Unknown'}
        imageUrl={connection.imageUrl || undefined}
        onClose={onClose}
        hideEditButtons={true}
        connectionType={levelName}
        connectionStatus={statusName}
      />

      {isPendingNew && (
        <View style={styles.pendingContainer}>
          <Text style={[theme.bodyText, { fontWeight: 'bold', marginBottom: 10 }]}>
            User has initiated a connection request.
          </Text>

          {!!levelDescription && (
            <View style={{ marginBottom: 10 }}>
              <Text style={theme.bodyText}>{levelDescription}</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              title="Reject"
              onPress={handleReject}
              color={theme.buttonSecondary.backgroundColor}
            />
            <Button
              title="Accept"
              onPress={handleAccept}
              color={theme.buttonPrimary.backgroundColor}
            />
          </View>
        </View>
      )}
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  pendingContainer: {
    marginTop: 25,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
  },
});
