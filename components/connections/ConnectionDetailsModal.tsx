// components/connections/ConnectionDetailsModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Button, Alert, FlatList } from "react-native";
import { useTheme } from "styled-components/native";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { HealthStatusArea } from "@/components/health/HealthStatusArea";
import { ConnectionManagement } from "@/components/connections/ConnectionManagement";
import { ConnectionLevelChange } from "@/components/connections/ConnectionLevelChange";
import { ConnectionDisconnect } from "@/components/connections/ConnectionDisconnect";
import { PendingElevation } from "./PendingElevation";
import { useConnections } from "@/src/context/ConnectionsContext";
import { useLookups } from "@/src/context/LookupContext";

import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable, Functions } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";

/** Represents a connection object (merged or single doc). */
export interface Connection {
  connectionDocId?: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;   // e.g. 2=New, 3=Friend, 4=Bond
  connectionStatus: number;  // 0 => pending, 1 => active
  senderSUUID: string;
  recipientSUUID: string;
  // For merges
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
  pendingLevelId?: number;

  // Exposure fields
  hasPendingExposure?: boolean;
  exposureAlertType?: "iRequested" | "theyRequested" | "both";
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
   * If you want to know if the base doc's recipientSUUID is "me" for certain logic,
   * typically used for accepting an initial L2 connection. 
   */
  isRecipient: boolean;

  /** The viewer's own SUUID. */
  mySUUID?: string;

  /** STDI definitions array. */
  stdis: STI[];
}

type ViewMode =
  | "results"
  | "management"
  | "changeLevel"
  | "pendingElevation"
  | "disconnect"
  | "pendingExposure";

export function ConnectionDetailsModal({
  visible,
  onClose,
  connection,
  isRecipient,
  mySUUID,
  stdis,
}: ConnectionDetailsModalProps) {
  const theme = useTheme();
  const { connectionLevels } = useLookups();
  const { refreshConnections } = useConnections();

  // Firestore and CF init
  const db = useMemo(() => getFirestore(firebaseApp), []);
  const functionsInstance = useMemo<Functions>(() => getFunctions(firebaseApp), []);
  const updateConnectionStatusCF = useMemo(
    () => httpsCallable(functionsInstance, "updateConnectionStatus"),
    [functionsInstance]
  );
  const updateConnectionLevelCF = useMemo(
    () => httpsCallable(functionsInstance, "updateConnectionLevel"),
    [functionsInstance]
  );
  const getUserHealthStatusesCF = useMemo(
    () => httpsCallable(functionsInstance, "getUserHealthStatuses"),
    [functionsInstance]
  );
  // optionally for exposure acceptance
  const respondExposureAlertsCF = useMemo(
    () => httpsCallable(functionsInstance, "respondExposureAlerts"),
    [functionsInstance]
  );

  // Local UI states
  const [levelName, setLevelName] = useState(`Level ${connection.connectionLevel}`);
  const [statusName, setStatusName] = useState(`Status ${connection.connectionStatus}`);
  const [levelDescription, setLevelDescription] = useState("");
  const [remoteStatuses, setRemoteStatuses] = useState<{ [key: string]: any }>({});
  const [loadingHealth, setLoadingHealth] = useState(false);

  // If doc is active => we can show "Manage" actions
  const canManage = connection.connectionStatus === 1;
  // Show health if at least L2
  const shouldShowHealth = canManage && connection.connectionLevel >= 2;

  // If there's a merged doc with a pending request
  const hasMergedPending = !!connection.pendingDocId;
  // If the pending doc's recipient is me => I'm the one who must accept that doc
  const isPendingDocRecipient = connection.pendingRecipientSUUID === mySUUID;

  // We'll choose viewMode depending on various states
  const [viewMode, setViewMode] = useState<ViewMode>("results");

  // On mount (or whenever connection changes), figure out which mode to show
  useEffect(() => {
    if (!visible) return;

    // If there's a merged doc pending elevation and I'm the recipient => show that
    if (canManage && hasMergedPending && isPendingDocRecipient) {
      setViewMode("pendingElevation");
      return;
    }

    // If there's a pending exposure => check if I'm supposed to accept/decline
    // That happens if exposureAlertType === "theyRequested"
    if (connection.hasPendingExposure && connection.exposureAlertType === "theyRequested") {
      setViewMode("pendingExposure");
      return;
    }

    // otherwise default to "results"
    setViewMode("results");
  }, [visible, canManage, hasMergedPending, isPendingDocRecipient, connection]);

  // Load base doc's level + status details
  useEffect(() => {
    if (!visible) return;
    let unsub = false;

    (async () => {
      try {
        // 1) load connectionLevels doc
        const levelRef = doc(db, "connectionLevels", String(connection.connectionLevel));
        const levelSnap = await getDoc(levelRef);
        if (!unsub && levelSnap.exists()) {
          setLevelName(levelSnap.data().name ?? `Level ${connection.connectionLevel}`);
          setLevelDescription(levelSnap.data().description ?? "");
        }
        // 2) load connectionStatuses doc
        const statusRef = doc(db, "connectionStatuses", String(connection.connectionStatus));
        const statusSnap = await getDoc(statusRef);
        if (!unsub && statusSnap.exists()) {
          setStatusName(statusSnap.data().name ?? `Status ${connection.connectionStatus}`);
        }
      } catch (err) {
        console.error("Error loading level/status docs:", err);
      }
    })();

    return () => {
      unsub = true;
    };
  }, [visible, db, connection.connectionLevel, connection.connectionStatus]);

  // If the doc is active and level >=2 => load remote user's health status
  useEffect(() => {
    if (!visible) return;
    if (!shouldShowHealth) return;
    if (!connection.connectionDocId) return;

    setLoadingHealth(true);
    (async function loadRemoteHealth() {
      try {
        const cDocSnap = await getDoc(doc(db, "connections", connection.connectionDocId!));
        if (!cDocSnap.exists()) {
          console.warn("Connection doc not found!");
          return;
        }
        const cDocData = cDocSnap.data();
        // The remote SUUID is the "other user"
        const remoteSUUID = isRecipient
          ? cDocData.senderSUUID
          : cDocData.recipientSUUID;
        if (!remoteSUUID) {
          console.warn("No remoteSUUID found in connection data!");
          return;
        }

        // For L2 or L3, we hide actual test dates => pass hideDate=true
        const hideDate = connection.connectionLevel === 2 || connection.connectionLevel === 3;
        const result = await getUserHealthStatusesCF({ suuid: remoteSUUID, hideDate });
        setRemoteStatuses(result.data?.statuses || {});
      } catch (err) {
        console.error("Error loading remote user health statuses:", err);
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

  // Check if this is a purely pending "New" doc => user can accept or reject the connection
  const isPendingNew =
    connection.connectionStatus === 0 &&
    connection.connectionLevel === 2 &&
    isRecipient;

  // Accept or reject a brand-new L2 doc
  async function handleAcceptNew() {
    if (!connection.connectionDocId) {
      Alert.alert("Error", "Missing connectionDocId for update!");
      return;
    }
    try {
      await updateConnectionStatusCF({
        docId: connection.connectionDocId,
        newStatus: 1,
      });
      Alert.alert("Accepted", "Connection accepted successfully!");
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error("Accept error:", err);
      Alert.alert("Error", err.message || "Could not accept.");
    }
  }
  async function handleRejectNew() {
    if (!connection.connectionDocId) {
      Alert.alert("Error", "Missing connectionDocId for update!");
      return;
    }
    try {
      await updateConnectionStatusCF({
        docId: connection.connectionDocId,
        newStatus: 2,
      });
      Alert.alert("Rejected", "Connection rejected.");
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error("Reject error:", err);
      Alert.alert("Error", err.message || "Could not reject.");
    }
  }

  // For toggling between "Manage" and "Results"
  const manageLabel = viewMode === "management" ? "Results" : "Manage";
  function handleManagePress() {
    setViewMode((prev) => (prev === "management" ? "results" : "management"));
  }

  // Up/down-level a connection
  async function handleChangeLevel(newLevel: number) {
    if (!connection.connectionDocId) {
      Alert.alert("Error", "No docId found.");
      return;
    }
    try {
      await updateConnectionLevelCF({
        docId: connection.connectionDocId,
        currentLevel: connection.connectionLevel,
        newLevel,
      });
      Alert.alert("Success", `Updated connection level to ${newLevel}`);
      setViewMode("management");
      refreshConnections();
    } catch (err: any) {
      console.error("updateConnectionLevel error:", err);
      Alert.alert("Error", err.message || "Unable to update connection level.");
    }
  }

  // Accept or Decline exposure request
  async function handleAcceptExposure() {
    if (!connection.connectionDocId) {
      Alert.alert("Error", "Missing connectionDocId.");
      return;
    }
    try {
      await respondExposureAlertsCF({
        connectionDocId: connection.connectionDocId,
        action: "accept",
      });
      Alert.alert("Accepted", "Exposure alerts accepted!");
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error("Error accepting exposure:", err);
      Alert.alert("Error", err.message || "Could not accept exposure alerts.");
    }
  }
  async function handleDeclineExposure() {
    if (!connection.connectionDocId) {
      Alert.alert("Error", "Missing connectionDocId.");
      return;
    }
    try {
      await respondExposureAlertsCF({
        connectionDocId: connection.connectionDocId,
        action: "decline",
      });
      Alert.alert("Declined", "Exposure alerts declined.");
      refreshConnections();
      onClose();
    } catch (err: any) {
      console.error("Error declining exposure:", err);
      Alert.alert("Error", err.message || "Could not decline exposure alerts.");
    }
  }

  // Header for the FlatList
  function renderHeader() {
    return (
      <View>
        <ProfileHeader
          displayName={connection.displayName || "Unknown"}
          imageUrl={connection.imageUrl || undefined}
          onClose={onClose}
          hideEditButtons={false}
          connectionType={levelName}
          connectionStatus={statusName}
          showManageButton={
            canManage &&
            viewMode !== "changeLevel" &&
            viewMode !== "pendingElevation" &&
            viewMode !== "pendingExposure"
          }
          manageLabel={manageLabel}
          onManagePress={handleManagePress}
        />

        {/* If this is a brand-new L2 doc => Accept/Reject UI */}
        {isPendingNew && (
          <View style={styles.pendingContainer}>
            <Text
              style={[theme.bodyText, { fontWeight: "bold", marginBottom: 10 }]}
            >
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

  // Footer for the FlatList => different UI segments depending on viewMode
  function renderFooter() {
    if (!canManage) return null;

    // If the user is seeing a pending exposure request
    if (viewMode === "pendingExposure") {
      return (
        <View style={[theme.centerContainer, { paddingHorizontal: 20 }]}>
          <Text
            style={[theme.bodyText, { fontWeight: "bold", marginVertical: 10 }]}
          >
            The other user has requested exposure alerts if you test positive.
          </Text>
          <View style={styles.buttonRow}>
            <Button
              title="Decline"
              onPress={handleDeclineExposure}
              color={theme.buttonSecondary.backgroundColor}
            />
            <Button
              title="Accept"
              onPress={handleAcceptExposure}
              color={theme.buttonPrimary.backgroundColor}
            />
          </View>
        </View>
      );
    }

    // If there's a pending doc for elevation (like L3→L4)
    if (viewMode === "pendingElevation") {
      return (
        <PendingElevation
          baseDocId={connection.connectionDocId!}
          pendingDocId={connection.pendingDocId!}
          pendingLevelName={connection.pendingLevelName!}
          pendingLevelId={connection.pendingLevelId}
          onClose={onClose}
        />
      );
    }

    // If showing "results", we show health data if the level≥2
    if (viewMode === "results") {
      if (!shouldShowHealth) return null;
      return (
        <View style={{ marginTop: 20 }}>
          <Text style={[theme.title, { textAlign: "center", marginBottom: 10 }]}>
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

    // "management" => show disconnect, change level, request exposure, etc.
    if (viewMode === "management") {
      return (
        <ConnectionManagement
          connection={connection}
          isRecipient={isRecipient}
          mySUUID={mySUUID}
          onChangeType={() => setViewMode("changeLevel")}
          onDisconnect={() => setViewMode("disconnect")}
          onRequestExposure={() =>
            Alert.alert("TODO", "Request Exposure Alerts action")
          }
        />
      );
    }

    // "changeLevel" => user picks new level => calls handleChangeLevel
    if (viewMode === "changeLevel") {
      return (
        <ConnectionLevelChange
          connection={connection}
          onCancel={() => setViewMode("management")}
          onLevelChanged={handleChangeLevel}
        />
      );
    }

    // "disconnect" => show "Are you sure?" flow
    if (viewMode === "disconnect") {
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
          onClose={() => setViewMode("management")}
        />
      );
    }

    return null;
  }

  return (
    <ThemedModal visible={visible} onRequestClose={onClose} useBlur>
      {/* We use an empty FlatList so we can have a scrollable area with header+footer */}
      <FlatList
        data={[]}
        keyExtractor={() => "dummy"}
        style={{ width: "100%" }}
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
    alignItems: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
});