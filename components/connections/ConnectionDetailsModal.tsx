import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from 'styled-components/native';
import { ThemedModal } from '@/components/ui/ThemedModal';
import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { HealthStatusArea } from '@/components/health/HealthStatusArea';

const functionsInstance = getFunctions(firebaseApp);
const updateConnectionStatusCF = httpsCallable(functionsInstance, "updateConnectionStatus");
const computeHashedIdCF = httpsCallable(functionsInstance, "computeHashedId");

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
  const db = getFirestore(firebaseApp);
  const colorScheme = useColorScheme() ?? 'light';
  const xIconColor = Colors[colorScheme].icon;

  // Load level and status names from lookup docs.
  const [levelName, setLevelName] = useState<string>(`Level ${connection.connectionLevel}`);
  const [statusName, setStatusName] = useState<string>(`Status ${connection.connectionStatus}`);
  const [levelDescription, setLevelDescription] = useState<string>("");

  useEffect(() => {
    let unsub = false;
    (async () => {
      try {
        const levelRef = doc(db, "connectionLevels", String(connection.connectionLevel));
        const levelSnap = await getDoc(levelRef);
        if (!unsub && levelSnap.exists()) {
          setLevelName(levelSnap.data().name ?? `Level ${connection.connectionLevel}`);
          setLevelDescription(levelSnap.data().description ?? "");
        }
        const statusRef = doc(db, "connectionStatuses", String(connection.connectionStatus));
        const statusSnap = await getDoc(statusRef);
        if (!unsub && statusSnap.exists()) {
          setStatusName(statusSnap.data().name ?? `Status ${connection.connectionStatus}`);
        }
      } catch (err) {
        console.error("Error loading level/status docs:", err);
      }
    })();
    return () => { unsub = true; };
  }, [connection, db]);

  // Load remote health statuses (for the remote user)
  const [remoteStatuses, setRemoteStatuses] = useState<{ [stdiId: string]: any }>({});
  const [loadingHealth, setLoadingHealth] = useState(false);
  const shouldShowHealth = connection.connectionStatus === 1 && connection.connectionLevel >= 2;

  useEffect(() => {
    if (!shouldShowHealth) return;
    if (!connection.connectionDocId) return;

    setLoadingHealth(true);

    (async function loadRemoteHealth() {
      try {
        const cDoc = await getDoc(doc(db, "connections", connection.connectionDocId!));
        if (!cDoc.exists()) {
          console.warn("Connection doc not found!");
          return;
        }
        const data = cDoc.data();
        // Determine the remote user's SUUID based on whether the current user is the recipient.
        const remoteSUUID = isRecipient ? data.senderSUUID : data.recipientSUUID;
        if (!remoteSUUID) {
          console.warn("No remoteSUUID found in connection data!");
          return;
        }
        const hResult = await computeHashedIdCF({ hashType: "health", inputSUUID: remoteSUUID });
        const remoteHsUUID = hResult.data.hashedId;
        const newStatuses: { [key: string]: any } = {};
        for (const stdi of stdis) {
          const docId = `${remoteHsUUID}_${stdi.id}`;
          const snap = await getDoc(doc(db, "healthStatus", docId));
          if (snap.exists()) {
            newStatuses[stdi.id] = snap.data();
          }
        }
        setRemoteStatuses(newStatuses);
      } catch (err) {
        console.error("Error loading remote user health statuses:", err);
      } finally {
        setLoadingHealth(false);
      }
    })();
  }, [shouldShowHealth, connection.connectionDocId, db, isRecipient, stdis]);
  
  async function handleAccept() {
    try {
      if (!connection.connectionDocId) {
        Alert.alert("Error", "Missing connectionDocId for update!");
        return;
      }
      await updateConnectionStatusCF({
        docId: connection.connectionDocId,
        newStatus: 1,
      });
      Alert.alert("Accepted", "Connection accepted successfully!");
      onClose();
    } catch (err: any) {
      console.error("Accept error:", err);
      Alert.alert("Error", err.message || "Could not accept.");
    }
  }

  async function handleReject() {
    try {
      if (!connection.connectionDocId) {
        Alert.alert("Error", "Missing connectionDocId for update!");
        return;
      }
      await updateConnectionStatusCF({
        docId: connection.connectionDocId,
        newStatus: 2,
      });
      Alert.alert("Rejected", "Connection rejected.");
      onClose();
    } catch (err: any) {
      console.error("Reject error:", err);
      Alert.alert("Error", err.message || "Could not reject.");
    }
  }

  // Determine whether to show the Accept/Reject controls (pending new connection)
  const isPendingNew =
    connection.connectionStatus === 0 &&
    connection.connectionLevel === 2 &&
    isRecipient;

  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      {/* Profile header with an X in the top-right */}
      <ProfileHeader
        displayName={connection.displayName || 'Unknown'}
        imageUrl={connection.imageUrl || undefined}
        onClose={onClose}
        hideEditButtons={true}
        connectionType={levelName}
        connectionStatus={statusName}
      />

      {/* If pending new, show accept/reject controls with level description */}
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

      {/* If accepted and level ≥ 2, show remote user's health statuses */}
      {shouldShowHealth && (
        <View style={{ marginTop: 20 }}>
          <Text style={[theme.title, { textAlign: 'center', marginBottom: 10 }]}>
            Remote User's Test Results
          </Text>
          {loadingHealth ? (
            <Text style={theme.bodyText}>Loading health data...</Text>
          ) : (
            <HealthStatusArea stdis={stdis} statuses={remoteStatuses} />
          )}
        </View>
      )}
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  pendingContainer: {
    marginTop: 25,
    alignItems: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "60%",
  },
});