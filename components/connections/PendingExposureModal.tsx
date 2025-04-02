// components/connections/PendingExposureModal.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import { useTheme } from 'styled-components/native';
import { getFirestore, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { computeHash } from '@/src/firebase/computeHashShim'; 
// Or call your CF if you prefer. This is just an example. 
// If you only do hashing in CF, you'll do it differently.

interface PendingExposureModalProps {
  visible: boolean;
  onClose: () => void;
  mySUUID: string;     // the user who might be “sender”
  otherSUUID: string;  // the user who requested alerts
}

/**
 * This modal finds any exposureAlerts with:
 *   sender=mySUUID, recipient=otherSUUID, status=0
 * and shows them as a single “The user requested exposure alerts. Accept or Decline?”
 * If user Accepts => sets status=1 for all, rewrites doc fields => hashed
 * If user Declines => sets status=2 for all, rewrites doc fields => hashed
 */
export function PendingExposureModal({
  visible,
  onClose,
  mySUUID,
  otherSUUID,
}: PendingExposureModalProps) {
  const theme = useTheme();
  const db = getFirestore(firebaseApp);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    checkAlerts();
  }, [visible]);

  async function checkAlerts() {
    // Query all docs in `exposureAlerts` that are status=0, 
    // sender=mySUUID, recipient=otherSUUID
    setLoading(true);
    try {
      const alertsRef = collection(db, 'exposureAlerts');
      const q = query(
        alertsRef,
        where('status', '==', 0),
        where('sender', '==', mySUUID),
        where('recipient', '==', otherSUUID),
      );
      const snap = await getDocs(q);
      setCount(snap.size);
    } catch (err) {
      console.error('Error checking pending exposure alerts:', err);
    }
    setLoading(false);
  }

  if (!visible || count === 0) {
    // No pending docs => hide or do nothing
    return null;
  }

  async function handleAccept() {
    // 1) find all pending alerts
    // 2) set status=1, do partial hashing
    setLoading(true);
    try {
      const q = query(
        collection(db, 'exposureAlerts'),
        where('status', '==', 0),
        where('sender', '==', mySUUID),
        where('recipient', '==', otherSUUID),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('None', 'No pending exposure alerts to accept.');
        setLoading(false);
        onClose();
        return;
      }
      // Build a batch
      const batch = writeBatch(db);

      for (const docSnap of snap.docs) {
        // Convert "sender" => ESUUID
        const docData = docSnap.data();
        const senderSUUID = docData.sender;
        const docRef = docSnap.ref;

        // If you do hashing via your CF, you’d call that here. 
        // For demonstration, let's do a local function:
        const esuuid = await computeHash('exposure', senderSUUID);
        batch.update(docRef, {
          status: 1,
          sender: esuuid,  // “sender” anonymized
          updatedAt: admin.firestore.FieldValue.serverTimestamp(), // or the local now
        });
        // If you do NOT want to anonymize the “recipient” upon acceptance, 
        // then skip. Otherwise, do the same for “recipient.”
      }

      await batch.commit();
      Alert.alert('Accepted', 'Exposure alerts accepted.');
      onClose();
    } catch (err: any) {
      console.error('Error accepting exposure alerts:', err);
      Alert.alert('Error', err.message || 'Could not accept exposure request.');
    }
    setLoading(false);
  }

  async function handleDecline() {
    // 1) find all pending alerts
    // 2) set status=2, convert both sender & recipient to ESUUID
    setLoading(true);
    try {
      const q = query(
        collection(db, 'exposureAlerts'),
        where('status', '==', 0),
        where('sender', '==', mySUUID),
        where('recipient', '==', otherSUUID),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('None', 'No pending exposure alerts to decline.');
        setLoading(false);
        onClose();
        return;
      }
      const batch = writeBatch(db);

      for (const docSnap of snap.docs) {
        const docData = docSnap.data();
        const senderSUUID = docData.sender;
        const recipientSUUID = docData.recipient;
        const docRef = docSnap.ref;

        const senderESUUID = await computeHash('exposure', senderSUUID);
        const recipientESUUID = await computeHash('exposure', recipientSUUID);

        batch.update(docRef, {
          status: 2,
          sender: senderESUUID,
          recipient: recipientESUUID,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      Alert.alert('Declined', 'Exposure request declined.');
      onClose();
    } catch (err: any) {
      console.error('Error declining exposure alerts:', err);
      Alert.alert('Error', err.message || 'Could not decline exposure request.');
    }
    setLoading(false);
  }

  return (
    <ThemedModal visible={true} onRequestClose={onClose} useBlur>
      <View style={[theme.centerContainer, { padding: 20 }]}>
        <Text style={[theme.title, { marginBottom: 15 }]}>
          Exposure Alert Request
        </Text>

        <Text style={[theme.bodyText, { marginBottom: 15 }]}>
          The user has requested to receive exposure alerts if you test positive
          for an STDI. 
        </Text>

        <View style={styles.buttonRow}>
          <Button
            title="Decline"
            onPress={handleDecline}
            color={theme.buttonSecondary.backgroundColor}
            disabled={loading}
          />
          <Button
            title="Accept"
            onPress={handleAccept}
            color={theme.buttonPrimary.backgroundColor}
            disabled={loading}
          />
        </View>
      </View>
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
});
