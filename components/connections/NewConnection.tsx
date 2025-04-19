// components/ui/NewConnection.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { ThemedButton } from "@/components/ui/ThemedButton";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function NewConnection({ visible, onClose }: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const newConnectionCF = httpsCallable(
    getFunctions(firebaseApp),
    "newConnection"
  );

  const validateEmail = (em: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim());

  /* ------------------------ main submit ------------------------ */
  const sendRequest = async (overrideBlock = false) => {
    if (!email || !validateEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await newConnectionCF({ email: email.trim(), overrideBlock });
      setRequestSent(true);
    } catch (err: any) {
      const code = err?.code;
      const msg  = err?.message;

      // Cloud Function threw blocked‑by‑sender
      if (
        code === "functions/failed-precondition" &&
        msg === "blocked-by-sender"
      ) {
        Alert.alert(
          "Blocked user",
          "You have blocked this user. Unblock and send a new connection request?",
          [
            { text: "No", style: "cancel" },
            { text: "Yes", onPress: () => sendRequest(true) },
          ]
        );
        return;
      }

      Alert.alert("Error", msg ?? "Something went wrong.");
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------ helpers ---------------------------- */
  const handleClose = () => {
    setEmail("");
    setRequestSent(false);
    onClose();
  };

  /* ------------------------ UI -------------------------------- */
  return (
    <ThemedModal visible={visible} onRequestClose={handleClose} useBlur>
      {!requestSent ? (
        <>
          <Text style={theme.modalTitle}>New Connection Request</Text>

          <TextInput
            style={theme.input}
            placeholder="user@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={theme.buttonRow}>
            <ThemedButton
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
            />
            <ThemedButton
              title={loading ? "Sending…" : "Connect"}
              variant="primary"
              disabled={loading}
              onPress={() => sendRequest()}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={theme.modalTitle}>Request Sent</Text>
          <Text style={theme.bodyText}>
            If a user with that email exists, your connection request has been
            sent.
          </Text>

          <View style={theme.buttonRow}>
            <ThemedButton
              title="Close"
              variant="primary"
              onPress={handleClose}
            />
          </View>
        </>
      )}
    </ThemedModal>
  );
}
