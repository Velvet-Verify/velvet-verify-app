// components/connections/ConnectionDetailsModal.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Button, Alert, TouchableOpacity } from 'react-native';
import { useTheme } from 'styled-components/native';
import { useAuth } from '@/src/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/src/firebase/config';
import { ThemedModal } from '@/components/ui/ThemedModal';
import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native'; // Or your custom hook if you prefer

export interface Connection {
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
  // Possibly fields like senderSUUID, recipientSUUID to know if user is the recipient
}

interface ConnectionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  connection: Connection;
  isRecipient: boolean;
}

export function ConnectionDetailsModal({
  visible,
  onClose,
  connection,
  isRecipient,
}: ConnectionDetailsModalProps) {
  const theme = useTheme();
  const { user } = useAuth(); // If needed for further logic
  const db = firebaseApp.firestore?.() ?? null; // or getFirestore(firebaseApp) if needed
  const [levelName, setLevelName] = useState<string>('');
  const [statusName, setStatusName] = useState<string>('');
  const [levelDescription, setLevelDescription] = useState<string>('');
  
  const colorScheme = useColorScheme() ?? 'light';
  const xIconColor = Colors[colorScheme].icon; // charcoal color from Colors

  // On mount/fetch: retrieve doc from connectionLevels/<connectionLevel> and connectionStatuses/<connectionStatus>
  useEffect(() => {
    if (!db || !connection) return;

    async function fetchLevelAndStatus() {
      try {
        // 1) Load ConnectionLevel doc
        const lvlRef = doc(db, 'connectionLevels', String(connection.connectionLevel));
        const lvlSnap = await getDoc(lvlRef);
        if (lvlSnap.exists()) {
          setLevelName(lvlSnap.data()?.name ?? '');
          setLevelDescription(lvlSnap.data()?.description ?? '');
        }

        // 2) Load ConnectionStatus doc
        const statRef = doc(db, 'connectionStatuses', String(connection.connectionStatus));
        const statSnap = await getDoc(statRef);
        if (statSnap.exists()) {
          setStatusName(statSnap.data()?.name ?? '');
        }
      } catch (err) {
        console.error('Error fetching connection-level or status doc:', err);
      }
    }

    fetchLevelAndStatus();
  }, [db, connection]);

  // Avatar or placeholder
  const avatarOrPlaceholder = connection.imageUrl ? (
    <Image source={{ uri: connection.imageUrl }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, { backgroundColor: '#ccc' }]} />
  );

  // Condition logic for "Accept/Reject"
  const isPendingNew = connection.connectionStatus === 0 && connection.connectionLevel === 2 && isRecipient;

  const handleAccept = () => {
    Alert.alert('Accept clicked', 'Implement logic here (e.g. update Firestore).');
  };

  const handleReject = () => {
    Alert.alert('Reject clicked', 'Implement logic here (e.g. update Firestore).');
  };

  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      {/* Top-right "X" to close */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={{ color: xIconColor, fontSize: 24 }}>X</Text>
      </TouchableOpacity>

      {/* Top profile section */}
      <View style={styles.topProfileContainer}>
        {avatarOrPlaceholder}
        <View style={styles.topTextContainer}>
          <Text style={theme.title}>
            {connection.displayName || 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Connection type on one line */}
      <View style={{ marginBottom: 6 }}>
        <Text style={theme.bodyText}>
          Connection Type: {levelName || `Level ${connection.connectionLevel}`}
        </Text>
      </View>

      {/* Connection status on another line */}
      <View style={{ marginBottom: 10 }}>
        <Text style={theme.bodyText}>
          Status: {statusName || `Status ${connection.connectionStatus}`}
        </Text>
      </View>

      {/* If pending & new & user is recipient => Accept/Reject row */}
      {isPendingNew && (
        <View style={styles.pendingContainer}>
          <Text style={[theme.bodyText, { fontWeight: 'bold', marginBottom: 10 }]}>
            User has initiated a connection request.
          </Text>
          <View style={styles.buttonRow}>
            {/* Reject on the left, Accept on the right */}
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

      {/* Show the level's description, if any */}
      {levelDescription ? (
        <View style={{ marginTop: 15 }}>
          <Text style={theme.bodyText}>{levelDescription}</Text>
        </View>
      ) : null}
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 999, // ensure above everything
  },
  topProfileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  topTextContainer: {
    flex: 1,
  },
  pendingContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%', // some spacing for side-by-side
  },
});
