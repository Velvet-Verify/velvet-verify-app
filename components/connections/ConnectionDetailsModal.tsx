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
import { useLookups } from '@/src/context/LookupContext';
import { PendingElevation } from './PendingElevation';
import { ConnectionDisconnect } from './ConnectionDisconnect';

export interface Connection {
  connectionDocId?: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number; // 0 => pending, 1 => active
  senderSUUID: string;
  recipientSUUID: string;
  // References for a merged (pending) doc
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
  // Optionally, you might include pendingLevelId if available
  pendingLevelId?: number;
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
  /**
   * This prop indicates if the current user is the base doc’s recipient.
   * (For merged docs the pending doc’s recipient is stored separately.)
   */
  isRecipient: boolean;
  mySUUID?: string;
  stdis: STI[];
}

type ViewMode =
  | 'results'
  | 'management'
  | 'changeLevel'
  | 'pendingElevation'
  | 'disconnect';

export function ConnectionDetailsModal({
  visible,
  onClose,
  connection,
  isRecipient,
  mySUUID,
  stdis,
}: ConnectionDetailsModalProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const { connectionLevels } = useLookups();
  const { refreshConnections } = useConnections();

  const db = useMemo(() => getFirestore(firebaseApp), []);
  const functionsInstance = useMemo<Functions>(() => getFunctions(firebaseApp), []);
  const updateConnectionStatusCF = useMemo(
    () => httpsCallable(functionsInstance, 'updateConnectionStatus'),
    [functionsInstance]
  );
  const updateConnectionLevelCF = useMemo(
    () => httpsCallable(functionsInstance, 'updateConnectionLevel'),
    [functionsInstance]
  );
  const getUserHealthStatusesCF = useMemo(
    () => httpsCallable(functionsInstance, 'getUserHealthStatuses'),
    [functionsInstance]
  );

  const [levelName, setLevelName] = useState(`Level ${connection.connectionLevel}`);
  const [statusName, setStatusName] = useState(`Status ${connection.connectionStatus}`);
  const [levelDescription, setLevelDescription] = useState('');
  const [remoteStatuses, setRemoteStatuses] = useState<{ [key: string]: any }>({});
  const [loadingHealth, setLoadingHealth] = useState(false);

  // The base doc is manageable if active (status===1)
  const canManage = connection.connectionStatus === 1;
  const shouldShowHealth = canManage && connection.connectionLevel >= 2;

  // Determine if there is a merged pending doc attached to the base doc.
  const hasMergedPending = !!connection.pendingDocId;
  // For merged docs we now store the pending doc’s recipient in connection.pendingRecipientSUUID.
  const isPendingDocRecipient = connection.pendingRecipientSUUID === mySUUID;

  // Default view mode is 'results' but for recipients with a pending elevation, default to 'pendingElevation'
  const [viewMode, setViewMode] = useState<ViewMode>('results');
  useEffect(() => {
    if (!visible) return;
    if (canManage && hasMergedPending && isPendingDocRecipient) {
      setViewMode('pendingElevation');
    }
  }, [visible, canManage, hasMergedPending, isPendingDocRecipient]);

  // Load base doc's level and status details
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
    return () => { unsub = true; };
  }, [visible, db, connection.connectionLevel, connection.connectionStatus]);

  // Load remote health statuses if applicable
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
  }, [visible, shouldShowHealth, connection.connectionDocId, connection.connectionLevel, isRecipient, db, getUserHealthStatusesCF]);

  // For purely pending "New" docs
  const isPendingNew = (
    connection.connectionStatus === 0 &&
    connection.connectionLevel === 2 &&
    isRecipient
  );

  async function handleAcceptNew() {
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

  async function handleRejectNew() {
    if (!connection.connectionDocId) {
      Alert.alert('Error', 'Missing connectionDocId for update!');
      return;
    }
    try {
      await updateConnectionStatusCF({ docId: connection.connectionDocId, newStatus: 2 });
      Alert.alert('Rejected', 'Connection rejected.');
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error('Reject error:', err);
      Alert.alert('Error', err.message || 'Could not reject.');
    }
  }

  const manageLabel = (viewMode === 'management') ? 'Results' : 'Manage';
  function handleManagePress() {
    setViewMode(prev => (prev === 'management' ? 'results' : 'management'));
  }

  async function handleChangeLevel(newLevel: number) {
    if (!connection.connectionDocId) {
      Alert.alert('Error', 'No docId found.');
      return;
    }
    try {
      await updateConnectionLevelCF({ 
        docId: connection.connectionDocId,
        currentLevel: connection.connectionLevel,
        newLevel 
      });
      Alert.alert('Success', `Updated connection level to ${newLevel}`);
      setViewMode('management');
      refreshConnections();
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
          showManageButton={canManage && viewMode !== 'changeLevel' && viewMode !== 'pendingElevation'}
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
                onPress={handleRejectNew}
                color={theme.buttonSecondary.backgroundColor}
              />
              <Button
                title="Accept"
                onPress={handleAcceptNew}
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
    if (viewMode === 'pendingElevation') {
      return (
        <PendingElevation
          baseDocId={connection.connectionDocId!}
          pendingDocId={connection.pendingDocId!}
          pendingLevelName={connection.pendingLevelName!}
          pendingLevelId={connection.pendingLevelId}  // May be undefined; PendingElevation will infer if needed.
          onClose={onClose}
        />
      );
    }
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
          isRecipient={isRecipient}
          mySUUID={mySUUID}
          onChangeType={() => setViewMode('changeLevel')}
          onDisconnect={() => setViewMode('disconnect')}
          onRequestExposure={() => Alert.alert('TODO', 'Request Exposure Alerts action')}
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
    if (viewMode === 'disconnect') {
      return (
        <ConnectionDisconnect
          baseDocId={connection.connectionDocId!}
          mySUUID={mySUUID!}
          // figure out who the other user is:
          otherSUUID={
            mySUUID === connection.senderSUUID
              ? connection.recipientSUUID
              : connection.senderSUUID
          }
          onClose={() => setViewMode('management')}
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
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
});