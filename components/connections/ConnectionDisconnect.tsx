// components/connections/ConnectionDisconnect.tsx
import React from "react";
import { View, Text, StyleSheet, Button, Alert } from "react-native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { useTheme } from "styled-components/native";
import { useConnections } from "@/src/context/ConnectionsContext";

/* ---------- props ---------- */
interface ConnectionDisconnectProps {
  baseDocId: string;          // the active doc we’re breaking up
  currentLevel: number;       // its current connectionLevel
  onClose: () => void;
  onCancel?: () => void;
}

export function ConnectionDisconnect({
  baseDocId,
  currentLevel,
  onClose,
  onCancel,
}: ConnectionDisconnectProps) {
  const theme = useTheme();
  const { refreshConnections } = useConnections();

  const fns = getFunctions(firebaseApp);
  const updateStatusCF  = httpsCallable(fns, "updateConnectionStatus");
  const updateLevelCF   = httpsCallable(fns, "updateConnectionLevel");

  /* ---- actions ---- */
  async function handleDeactivateOnly() {
    try {
      // just mark the doc “deactivated”
      await updateStatusCF({ docId: baseDocId, newStatus: 4 });
      Alert.alert("Disconnected", "The connection has been deactivated.");
      refreshConnections();
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not deactivate.");
    }
  }

  async function handleDeactivateAndBlock() {
    try {
      /*  one call does both:
          – deactivates the current doc
          – creates an ACTIVE level‑1 (blocked) doc               */
      await updateLevelCF({
        docId: baseDocId,
        currentLevel,           // e.g. 2/3/4/5
        newLevel: 1,            // 1 = Blocked
      });

      Alert.alert("Blocked", "This user is now blocked.");
      refreshConnections();
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not block user.");
    }
  }

  /* ---- ui ---- */
  function handleCancel() {
    (onCancel ?? onClose)();
  }

  return (
    <View style={[theme.centerContainer, styles.container]}>
      <Text style={[theme.bodyText, { marginBottom: 15, textAlign: "center" }]}>
        Would you also like to block this user to prevent future requests?
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

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { padding: 20 },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 15,
  },
});