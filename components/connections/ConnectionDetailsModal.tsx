// components/connections/ConnectionDetailsModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, FlatList } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { useColorScheme } from 'react-native';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { HealthStatusArea } from '@/components/health/HealthStatusArea';
import { ConnectionManagement } from '@/components/connections/ConnectionManagement';
import { ConnectionLevelChange } from '@/components/connections/ConnectionLevelChange';
import { useConnections } from '@/src/context/ConnectionsContext';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';

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

  const { refreshConnections } = useConnections();

  const db = useMemo(() => getFirestore(firebaseApp), []);
  const functionsInstance = useMemo<Functions>(() => getFunctions(firebaseApp), []);
  const updateConnectionStatusCF = useMemo(() => httpsCallable(functionsInstance, 'updateConnectionStatus'), [functionsInstance]);
  const updateConnectionLevelCF = useMemo(() => httpsCallable(functionsInstance, 'updateConnectionLevel'), [functionsInstance]);
  const getUserHealthStatusesCF = useMemo(() => httpsCallable(functionsInstance, 'getUserHealthStatuses'), [functionsInstance]);

  const [levelName, setLevelName] = useState(`Level ${connection.connectionLevel}`);
  const [statusName, setStatusName] = useState(`Status ${connection.connectionStatus}`);
  const [levelDescription, setLevelDescription] = useState('');
  const [remoteStatuses, setRemoteStatuses] = useState<{ [key: string]: any }>({});
  const [loadingHealth, setLoadingHealth] = useState(false);

  type ViewMode = 'results' | 'management' | 'changeLevel';
  const [viewMode, setViewMode] = useState<ViewMode>('results');

  const canManage = connection.connectionStatus === 1;
  const shouldShowHealth = canManage && connection.connectionLevel >= 2;

  useEffect(() => {
    if (!visible) return;
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
        const remoteSUUID = isRecipient ? cDocData.senderSUUID : cDocData.recipientSUUID;
        if (!remoteSUUID) {
          console.warn('No remoteSUUID found in connection data!');
          return;
        }
        const hideDate = connection.connectionLevel === 2 || connection.connectionLevel === 3;
        const result = await getUserHealthStatusesCF({ suuid: remoteSUUID, hideDate });
        setRemoteStatuses(result.data?.statuses || {});
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

  async function handleAccept() {
    if (!connection.connectionDocId) {
      Alert.alert('Error', 'Missing connectionDocId for update!');
      return;
    }
    try {
      await updateConnectionStatusCF({ docId: connection.connectionDocId, newStatus: 1 });
      Alert.alert('Accepted', 'Connection accepted successfully!');
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error('Accept error:', err);
      Alert.alert('Error', err.message || 'Could not accept.');
    }
  }

  async function handleReject() {
    if (!connection.connectionDocId) {
      Alert.alert('Error', 'Missing connectionDocId for update!');
      return;
    }
    try {
      await updateConnectionStatusCF({ docId: connection.connectionDocId, newStatus: 2 });
      Alert.alert('Rejected', 'Connection rejected.');
      onClose();
    } catch (err: any) {
      console.error('Reject error:', err);
      Alert.alert('Error', err.message || 'Could not reject.');
    }
  }

  const isPendingNew = connection.connectionStatus === 0 && connection.connectionLevel === 2 && isRecipient;

  const manageLabel = (viewMode === 'management') ? 'Results' : 'Manage';
  function handleManagePress() {
    if (viewMode === 'management') {
      setViewMode('results');
    } else if (viewMode === 'results') {
      setViewMode('management');
    }
  }

  async function handleChangeLevel(newLevel: number) {
    if (!connection.connectionDocId) {
      Alert.alert('Error', 'No docId found.');
      return;
    }
    try {
      // Example call to a CF. Customize as you need:
      await updateConnectionLevelCF({ 
        docId: connection.connectionDocId,
        currentLevel: connection.connectionLevel,
        newLevel 
      });
      Alert.alert('Success', `Updated connection level to ${newLevel}`);
      setViewMode('management');
    } catch (err: any) {
      console.error('updateConnectionLevel error:', err);
      Alert.alert('Error', err.message || 'Unable to update connection level.');
    }
  }

  function renderHeader() {
    return (
      <View>
        <ProfileHeader
          displayName={connection.displayName || 'Unknown'}
          imageUrl={connection.imageUrl || undefined}
          onClose={onClose}
          hideEditButtons={false}
          connectionType={levelName}
          connectionStatus={statusName}
          showManageButton={canManage && viewMode !== 'changeLevel'}
          manageLabel={manageLabel}
          onManagePress={handleManagePress}
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
      </View>
    );
  }

  function renderFooter() {
    if (!canManage) return null;
    if (viewMode === 'results') {
      if (!shouldShowHealth) return null;
      return (
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
      );
    }
    if (viewMode === 'management') {
      return (
        <ConnectionManagement
          connection={connection}
          onChangeType={() => setViewMode('changeLevel')}
          onDisconnect={() => Alert.alert('TODO', 'Disconnect action')}
          onStartFling={() => Alert.alert('TODO', 'Start a Fling action')}
        />
      );
    }
    if (viewMode === 'changeLevel') {
      return (
        <ConnectionLevelChange
          connection={connection}
          onCancel={() => setViewMode('management')}
          onLevelChanged={handleChangeLevel}
        />
      );
    }
    return null;
  }

  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      <FlatList
        data={[]}
        keyExtractor={() => 'dummy'}
        style={{ width: '100%' }}
        contentContainerStyle={{ flexGrow: 1 }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
      />
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