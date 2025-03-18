// components/connections/ConnectionDetailsModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { HealthStatusArea } from '@/components/health/HealthStatusArea';
import { ConnectionManagement } from '@/components/connections/ConnectionManagement';

export interface Connection {
  connectionDocId?: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
  senderSUUID: string;
  recipientSUUID: string;
}

interface STI {
  id: string;
  name?: string;
  windowPeriodMax?: number;
}

interface ConnectionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  connection: Connection;
  isRecipient: boolean;
  stdis: STI[];
}

export function ConnectionDetailsModal({
  visible,
  onClose,
  connection,
  isRecipient,
  stdis,
}: ConnectionDetailsModalProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const xIconColor = Colors[colorScheme].icon;

  const db = useMemo(() => getFirestore(firebaseApp), []);
  const functionsInstance = useMemo<Functions>(() => getFunctions(firebaseApp), []);
  
  // Create references to your Cloud Functions, stable across renders
  const updateConnectionStatusCF = useMemo(
    () => httpsCallable(functionsInstance, 'updateConnectionStatus'),
    [functionsInstance]
  );
  const getUserHealthStatusesCF = useMemo(
    () => httpsCallable(functionsInstance, 'getUserHealthStatuses'),
    [functionsInstance]
  );

  const [levelName, setLevelName] = useState<string>(`Level ${connection.connectionLevel}`);
  const [statusName, setStatusName] = useState<string>(`Status ${connection.connectionStatus}`);
  const [levelDescription, setLevelDescription] = useState<string>('');

  const [remoteStatuses, setRemoteStatuses] = useState<{ [key: string]: any }>({});
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Local state to toggle between “health results” and “management”
  const [showManagement, setShowManagement] = useState(false);

  // Decide if we show remote user’s health data
  const shouldShowHealth = connection.connectionStatus === 1 && connection.connectionLevel >= 2;

  // Load connectionLevel / status from Firestore (once per open)
  useEffect(() => {
    if (!visible) return; // Only load once when we open the modal
    let unsub = false;

    (async () => {
      try {
        const levelRef = doc(db, 'connectionLevels', String(connection.connectionLevel));
        const levelSnap = await getDoc(levelRef);
        if (!unsub && levelSnap.exists()) {
          setLevelName(levelSnap.data().name ?? `Level ${connection.connectionLevel}`);
          setLevelDescription(levelSnap.data().description ?? '');
        }
        const statusRef = doc(db, 'connectionStatuses', String(connection.connectionStatus));
        const statusSnap = await getDoc(statusRef);
        if (!unsub && statusSnap.exists()) {
          setStatusName(statusSnap.data().name ?? `Status ${connection.connectionStatus}`);
        }
      } catch (err) {
        console.error('Error loading level/status docs:', err);
      }
    })();

    return () => {
      unsub = true;
    };
  }, [visible, db, connection.connectionLevel, connection.connectionStatus]);

  // Only load remote health once per open, if we have a docId and shouldShowHealth
  // This won't keep re-triggering because `visible`, `connectionDocId`, etc. won't keep changing
  useEffect(() => {
    if (!visible) return;
    if (!shouldShowHealth) return;
    if (!connection.connectionDocId) return;

    setLoadingHealth(true);
    (async function loadRemoteHealth() {
      try {
        const cDocSnap = await getDoc(doc(db, 'connections', connection.connectionDocId!));
        if (!cDocSnap.exists()) {
          console.warn('Connection doc not found!');
          return;
        }
        const cDocData = cDocSnap.data();

        // Determine the remote user’s SUUID
        const remoteSUUID = isRecipient ? cDocData.senderSUUID : cDocData.recipientSUUID;
        if (!remoteSUUID) {
          console.warn('No remoteSUUID found in connection data!');
          return;
        }

        const hideDate = connection.connectionLevel === 2 || connection.connectionLevel === 3;

        const result = await getUserHealthStatusesCF({
          suuid: remoteSUUID,
          hideDate,
        });

        const returnedStatuses = result.data?.statuses || {};
        setRemoteStatuses(returnedStatuses);
      } catch (err) {
        console.error('Error loading remote user health statuses:', err);
      } finally {
        setLoadingHealth(false);
      }
    })();
  }, [
    visible,
    shouldShowHealth,
    connection.connectionDocId,
    connection.connectionLevel,
    isRecipient,
    db,
    getUserHealthStatusesCF,
  ]);

  // Accept/Reject logic
  async function handleAccept() {
    try {
      if (!connection.connectionDocId) {
        Alert.alert('Error', 'Missing connectionDocId for update!');
        return;
      }
      await updateConnectionStatusCF({
        docId: connection.connectionDocId,
        newStatus: 1,
      });
      Alert.alert('Accepted', 'Connection accepted successfully!');
      onClose();
    } catch (err: any) {
      console.error('Accept error:', err);
      Alert.alert('Error', err.message || 'Could not accept.');
    }
  }

  async function handleReject() {
    try {
      if (!connection.connectionDocId) {
        Alert.alert('Error', 'Missing connectionDocId for update!');
        return;
      }
      await updateConnectionStatusCF({
        docId: connection.connectionDocId,
        newStatus: 2,
      });
      Alert.alert('Rejected', 'Connection rejected.');
      onClose();
    } catch (err: any) {
      console.error('Reject error:', err);
      Alert.alert('Error', err.message || 'Could not reject.');
    }
  }

  const isPendingNew =
    connection.connectionStatus === 0 &&
    connection.connectionLevel === 2 &&
    isRecipient;

  // For the “Manage <-> Results” toggle
  // We only show it if connectionStatus == 1 (i.e. “active”)
  const canManage = connection.connectionStatus === 1;
  const manageLabel = showManagement ? "Results" : "Manage";
  const handleManagePress = () => setShowManagement(prev => !prev);
  
  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      <ProfileHeader
        displayName={connection.displayName || 'Unknown'}
        imageUrl={connection.imageUrl || undefined}
        onClose={onClose}
        hideEditButtons={false}
        connectionType={levelName}
        connectionStatus={statusName}
        showManageButton={canManage}
        manageLabel={manageLabel}
        onManagePress={handleManagePress}
      />

      {isPendingNew && (
        <View style={styles.pendingContainer}>
          <Text style={[theme.bodyText, { fontWeight: 'bold', marginBottom: 10 }]}>
            User has initiated a connection request.
          </Text>
          {Boolean(levelDescription) && (
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

      

      {/* If showManagement is false => show health. If true => show management. */}
      {canManage && !showManagement && shouldShowHealth && (
        <View style={{ marginTop: 20 }}>
          <Text style={[theme.title, { textAlign: 'center', marginBottom: 10 }]}>
            Test Results
          </Text>
          {loadingHealth ? (
            <Text style={theme.bodyText}>Loading health data...</Text>
          ) : (
            <HealthStatusArea stdis={stdis} statuses={remoteStatuses} />
          )}
        </View>
      )}
      {canManage && showManagement && (
        <ConnectionManagement
          connection={connection}
          onChangeType={() => Alert.alert("TODO", "Change Connection Type action")}
          onDisconnect={() => Alert.alert("TODO", "Disconnect action")}
          onStartFling={() => Alert.alert("TODO", "Start a Fling action")}
        />
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