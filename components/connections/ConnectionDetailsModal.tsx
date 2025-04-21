// components/connections/ConnectionDetailsModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Platform,
  StyleSheet,
  ScrollView,
  Button,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { HealthStatusArea } from '@/components/health/HealthStatusArea';
import { ConnectionManagement } from '@/components/connections/ConnectionManagement';
import { ConnectionLevelChange } from '@/components/connections/ConnectionLevelChange';
import { ConnectionDisconnect } from '@/components/connections/ConnectionDisconnect';
import { PendingElevation } from './PendingElevation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { useConnections } from '@/src/context/ConnectionsContext';
import { useLookups } from '@/src/context/LookupContext';
import { ThemedButton } from '@/components/ui/ThemedButton';

/* ---------- constants ---------- */
const MODAL_HEIGHT = Math.floor(Dimensions.get('window').height * 0.8);

/* ---------- helpers ------------ */
function actionLabelForLevel(level: number) {
  switch (level) {
    case 2: return 'Change Connection Type';
    case 3: return 'Change Connection Type';
    case 4: return 'Change Connection Type';
    case 5: return 'Change Connection Type';
    default: return '';
  }
}

/* ----------- types ------------- */
export interface Connection { /* …unchanged… */ }
interface STI { id: string; name?: string; windowPeriodMax?: number }
interface Props {
  visible: boolean; onClose: () => void; connection: Connection;
  isRecipient: boolean; mySUUID?: string; stdis: STI[];
}
type ViewMode =
  | 'results' | 'management' | 'changeLevel'
  | 'pendingElevation' | 'disconnect' | 'pendingExposure';

/* --------- component ---------- */
export function ConnectionDetailsModal({
  visible, onClose, connection, isRecipient, mySUUID, stdis,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshConnections } = useConnections();
  const { connectionLevels } = useLookups();

  /* cloud */
  const db = useMemo(() => getFirestore(firebaseApp), []);
  const fns = useMemo<Functions>(() => getFunctions(firebaseApp), []);
  const updateConnectionStatusCF = useMemo(() => httpsCallable(fns, 'updateConnectionStatus'), [fns]);
  const updateConnectionLevelCF  = useMemo(() => httpsCallable(fns, 'updateConnectionLevel' ), [fns]);
  const getUserHealthStatusesCF  = useMemo(() => httpsCallable(fns, 'getUserHealthStatuses'), [fns]);

  /* local state */
  const [viewMode, setViewMode] = useState<ViewMode>('results');
  const [levelName,  setLevelName ] = useState(`Level ${connection.connectionLevel}`);
  const [statusName, setStatusName] = useState(`Status ${connection.connectionStatus}`);
  const [levelDescription, setLevelDescription] = useState('');
  const [remoteStatuses,  setRemoteStatuses ] = useState<Record<string, any>>({});
  const [loadingHealth,   setLoadingHealth  ] = useState(false);

  /* flags */
  const canManage          = connection.connectionStatus === 1;
  const shouldShowHealth   = canManage && connection.connectionLevel >= 2;
  const hasMergedPending   = !!connection.pendingDocId;
  const isPendingRecipient = connection.pendingRecipientSUUID === mySUUID;

  /* view‑mode decision */
  useEffect(() => {
    if (!visible) return;
    if (canManage && hasMergedPending && isPendingRecipient)
      setViewMode('pendingElevation');
    else if (connection.hasPendingExposure && connection.exposureAlertType === 'theyRequested')
      setViewMode('pendingExposure');
    else setViewMode('results');
  }, [visible, canManage, hasMergedPending, isPendingRecipient, connection]);

  /* level / status names */
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const [lvlSnap, stsSnap] = await Promise.all([
          getDoc(doc(db, 'connectionLevels',   String(connection.connectionLevel))),
          getDoc(doc(db, 'connectionStatuses', String(connection.connectionStatus))),
        ]);
        if (lvlSnap.exists())
          setLevelName(lvlSnap.data().name ?? `Level ${connection.connectionLevel}`);
        if (lvlSnap.exists())
          setLevelDescription(lvlSnap.data().description ?? '');
        if (stsSnap.exists())
          setStatusName(stsSnap.data().name ?? `Status ${connection.connectionStatus}`);
      } catch (err) { console.warn('load level/status', err); }
    })();
  }, [visible, db, connection]);

  /* remote health */
  useEffect(() => {
    if (!visible || !shouldShowHealth || !connection.connectionDocId) return;
    setLoadingHealth(true);
    (async () => {
      try {
        const baseSnap = await getDoc(doc(db, 'connections', connection.connectionDocId!));
        if (!baseSnap.exists()) return;
        const other = isRecipient ? baseSnap.data().senderSUUID : baseSnap.data().recipientSUUID;
        if (!other) return;
        const hideDate = connection.connectionLevel < 5;
        const res = await getUserHealthStatusesCF({ suuid: other, hideDate });
        setRemoteStatuses(res.data?.statuses || {});
      } catch (err) { console.warn('health error', err); }
      finally       { setLoadingHealth(false); }
    })();
  }, [visible, shouldShowHealth, connection, isRecipient, db, getUserHealthStatusesCF]);

  /* handlers */
  async function handleChangeLevel(newLevel: number) {
    if (!connection.connectionDocId) return;
    try {
      await updateConnectionLevelCF({
        docId: connection.connectionDocId,
        currentLevel: connection.connectionLevel,
        newLevel,
      });

      const msg =
        newLevel > connection.connectionLevel
          ? 'Connection request sent.'
          : 'Connection level updated.';

      Alert.alert('Success', msg);
      refreshConnections();
      onClose();
    } catch (err: any) { Alert.alert('Error', err.message || 'Could not update level.'); }
  }

  /* ---------- sub‑views ------------ */ 
  const ResultsView = () => {
    const label = actionLabelForLevel(connection.connectionLevel);
    const BASE_GAP   = Platform.OS === 'ios' ? 0 : 56;
    const bottomGap  = insets.bottom + BASE_GAP;
  
    /* --- NEW: did I send a pending‑elevation request? --- */
    const iSentPendingRequest =
      !!connection.pendingDocId && connection.pendingSenderSUUID === mySUUID;
  
    return (
      <View style={styles.flexOne}>
        {/* fixed title */}
        <Text style={[theme.title, { marginTop: 6 }]}>Test Results</Text>
  
        {/* scrollable test cards */}
        {loadingHealth ? (
          <ActivityIndicator
            color={theme.buttonPrimary.backgroundColor}
            size="large"
            style={{ flex: 1 }}
          />
        ) : (
          <ScrollView
            style={styles.flexOne}
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: bottomGap + 46 }}
          >
            <HealthStatusArea stdis={stdis} statuses={remoteStatuses} />
          </ScrollView>
        )}
  
        {/* ---------- bottom button ---------- */}
        {iSentPendingRequest ? (
          <ThemedButton
            title="Cancel Elevation Request"
            variant="primary"
            onPress={() =>
              Alert.alert(
                'Cancel Request?',
                'Are you sure you want to cancel this elevation request?',
                [
                  { text: 'No' },
                  {
                    text: 'Yes',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await updateConnectionStatusCF({
                          docId: connection.pendingDocId,
                          newStatus: 5,      // 5 = cancelled
                        });
                        refreshConnections();
                        onClose();
                        Alert.alert('Request Cancelled');
                      } catch (err: any) {
                        Alert.alert('Error', err.message || 'Could not cancel.');
                      }
                    },
                  },
                ],
              )
            }
            style={{
              alignSelf: 'center',
              marginTop: 12,
              marginBottom: bottomGap,
              width: '100%',
            }}
          />
        ) : (
          label && (
            <ThemedButton
              title={label}
              variant="primary"
              onPress={() => setViewMode('changeLevel')}
              style={{
                alignSelf: 'center',
                marginTop: 12,
                marginBottom: bottomGap,
                width: '100%',
              }}
            />
          )
        )}
      </View>
    );
  };

  /* -------- render -------- */
  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      {/* The wrapper now has a real height → everything lays out correctly */}
      <View style={{ width: '100%', height: MODAL_HEIGHT }}>
        {/* ---- fixed header ---- */}
        <ProfileHeader
          displayName={connection.displayName || 'Unknown'}
          imageUrl={connection.imageUrl || undefined}
          onClose={onClose}
          hideEditButtons={false}
          connectionType={levelName}
          connectionStatus={statusName}
          showManageButton={
            canManage &&
            !['pendingElevation', 'pendingExposure', 'disconnect', 'changeLevel'].includes(viewMode)
          }
          manageLabel="Disconnect"
          onManagePress={() => setViewMode('disconnect')}
        />

        {/* ---- L2 pending accept/reject just below header ---- */}
        {connection.connectionStatus === 0 &&
          connection.connectionLevel === 2 &&
          isRecipient && (
            <View style={styles.pendingContainer}>
              <Text style={[theme.bodyText, { fontWeight: 'bold', marginBottom: 8 }]}>
                User has initiated a connection request.
              </Text>
              {!!levelDescription && (
                <Text style={[theme.bodyText, { marginBottom: 8 }]}>{levelDescription}</Text>
              )}
              <View style={styles.buttonRow}>
                <Button
                  title="Reject"
                  color={theme.buttonSecondary.backgroundColor}
                  onPress={async () => {
                    try {
                      await updateConnectionStatusCF({
                        docId: connection.connectionDocId,
                        newStatus: 2,   // rejected
                      });
                      refreshConnections();          // pull new data
                      onClose();                     // close modal
                    } catch (err: any) {
                      Alert.alert("Error", err.message ?? "Could not reject request.");
                    }
                  }}
                />

                <Button
                  title="Accept"
                  color={theme.buttonPrimary.backgroundColor}
                  onPress={async () => {
                    try {
                      await updateConnectionStatusCF({
                        docId: connection.connectionDocId,
                        newStatus: 1,   // accepted
                      });
                      refreshConnections();
                      onClose();
                    } catch (err: any) {
                      Alert.alert("Error", err.message ?? "Could not accept request.");
                    }
                  }}
                />
              </View>
            </View>
          )}

        {/* ---- flexible / scrollable body ---- */}
        <View style={[styles.flexOne, { overflow: 'hidden' }]}>
          {viewMode === 'results' && shouldShowHealth && <ResultsView />}

          {viewMode === 'management' && (
            <ScrollView style={styles.flexOne} contentContainerStyle={{ paddingBottom: 20 }}>
              <ConnectionManagement
                connection={connection}
                isRecipient={isRecipient}
                mySUUID={mySUUID}
                onChangeType={() => setViewMode('changeLevel')}
                onDisconnect={() => setViewMode('disconnect')}
              />
            </ScrollView>
          )}

          {viewMode === 'changeLevel' && (
            <ScrollView style={styles.flexOne} contentContainerStyle={{ paddingBottom: 20 }}>
              <ConnectionLevelChange
                connection={connection}
                onCancel={() => setViewMode('results')}
                onLevelChanged={handleChangeLevel}
                onDisconnect={() => setViewMode('disconnect')}
              />
            </ScrollView>
          )}

          {viewMode === 'disconnect' && (
            <ScrollView style={styles.flexOne} contentContainerStyle={{ paddingBottom: 20 }}>
              <ConnectionDisconnect
                baseDocId={connection.connectionDocId!}
                currentLevel={connection.connectionLevel}
                onClose={onClose}
              />
            </ScrollView>
          )}

          {viewMode === 'pendingElevation' && (
            <ScrollView style={styles.flexOne} contentContainerStyle={{ paddingBottom: 20 }}>
              <PendingElevation
                baseDocId={connection.connectionDocId!}
                pendingDocId={connection.pendingDocId!}
                pendingLevelName={connection.pendingLevelName!}
                pendingLevelId={connection.pendingLevelId}
                onClose={onClose}
              />
            </ScrollView>
          )}

        </View>
      </View>
    </ThemedModal>
  );
}

/* -------- styles -------- */
const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  pendingContainer: { alignItems: 'center', marginTop: 16 },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
});