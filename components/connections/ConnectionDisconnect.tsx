// components/connections/ConnectionDisconnect.tsx
import React from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '@/src/firebase/config';
import { useTheme } from 'styled-components/native';
import { useConnections } from '@/src/context/ConnectionsContext';

interface ConnectionDisconnectProps {
  /** The active docId to be deactivated (status=4). */
  baseDocId: string;
  /** The caller’s SUUID (the person doing the disconnect). */
  mySUUID: string;
  /** The other user’s SUUID. We need it if we want to create the new “blocked” doc. */
  otherSUUID: string;

  /** Called when user finishes (Yes/No/Cancel) so we can close the sub-component. */
  onClose: () => void;
}

export function ConnectionDisconnect({
  baseDocId,
  mySUUID,
  otherSUUID,
  onClose,
}: ConnectionDisconnectProps) {
  const theme = useTheme();
  const { refreshConnections } = useConnections();
  const functionsInstance = getFunctions(firebaseApp);
  const updateConnectionStatusCF = httpsCallable(functionsInstance, 'updateConnectionStatus');
  const createNewConnectionCF = httpsCallable(functionsInstance, 'updateConnectionLevel'); 
  // Actually, for a brand‐new doc, you might do a different CF (like how you do newConnection) 
  // or just do it in "updateConnectionLevel"— but you can also create a new CF if you prefer.

  async function handleDeactivateOnly() {
    try {
      // Deactivate the existing doc => status=4
      await updateConnectionStatusCF({ docId: baseDocId, newStatus: 4 });
      Alert.alert('Disconnected', 'You have disconnected from this user.');
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error('Error deactivating connection:', err);
      Alert.alert('Error', err.message || 'Could not deactivate connection.');
    }
  }

  async function handleDeactivateAndBlock() {
    try {
      // 1) Deactivate the existing doc => status=4
      await updateConnectionStatusCF({ docId: baseDocId, newStatus: 4 });

      // 2) Create a new doc with:
      //    connectionLevel=1 (Blocked), connectionStatus=1 (Active),
      //    senderSUUID = mySUUID, recipientSUUID = otherSUUID, etc.
      // You can either:
      // (a) call your existing "newConnection" CF but with special 
      //     connectionLevel=1 and special logic if you want
      // (b) call "updateConnectionLevel" with newLevel=1 
      // (c) or define a new CF 
      // Below is just an example if you choose "newConnection" style:

      const createDocCF = httpsCallable(functionsInstance, 'newConnection');
      await createDocCF({
        // You might store "Block" doc differently. 
        // For instance, your "newConnection" CF always sets connectionLevel=2. 
        // So maybe you want a new CF. 
        // For demonstration, let's do a separate CF param:
        email: 'BLOCK_MODE', // obviously not a real email 
        blockMode: true,     // you can interpret that in your CF 
        // or if your "newConnection" doesn't support that, 
        // you can do a brand new CF, e.g. "blockUser" CF
      });

      // Alternatively, you might do a direct Firestore write from client. 
      // But typically you'd keep all logic in CF. 
      // So do whichever route is consistent with your design.

      Alert.alert('Blocked', 'User has been blocked from future requests.');
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error('Error blocking user:', err);
      Alert.alert('Error', err.message || 'Could not block user.');
    }
  }

  function handleCancel() {
    onClose(); // do nothing special
  }

  return (
    <View style={[theme.centerContainer, styles.container]}>
      <Text style={[theme.bodyText, { marginBottom: 15, textAlign: 'center' }]}>
        Would you like to block this user to prevent future connection requests?
      </Text>

      <View style={styles.buttonRow}>
        <Button
          title="Cancel"
          onPress={handleCancel}
          color={theme.buttonSecondary.backgroundColor}
        />
        <Button
          title="No"
          onPress={handleDeactivateOnly}
          color={theme.buttonSecondary.backgroundColor}
        />
        <Button
          title="Yes"
          onPress={handleDeactivateAndBlock}
          color={theme.buttonPrimary.backgroundColor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // or 'space-around'
    width: '100%',
    marginTop: 15,
  },
});