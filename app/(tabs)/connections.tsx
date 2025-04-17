// app/(tabs)/connections.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnections } from "@/src/context/ConnectionsContext";
import { useTheme } from "styled-components/native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/firebase/config";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/src/context/AuthContext";
import { useStdis } from "@/hooks/useStdis";
import { ThemedButton } from "@/components/ui/ThemedButton";
import { NewConnection } from "@/components/connections/NewConnection";
import { ConnectionDetailsModal } from "@/components/connections/ConnectionDetailsModal";
import { ConnectionItem } from "@/components/connections/ConnectionItem";
import { useLookups } from "@/src/context/LookupContext";

export interface Connection {
  connectionDocId?: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
  connectionLevel: number;   // 1=Blocked, 2=New, 3=Fling, 4=Friend, 5=Bond
  connectionStatus: number;  // 0=pending, 1=active, etc.
  senderSUUID: string;
  recipientSUUID: string;
}

interface DisplayConnection extends Connection {
  pendingDocId?: string;
  pendingSenderSUUID?: string;
  pendingRecipientSUUID?: string;
  pendingLevelName?: string;
  pendingLevelId?: number;

  hasPendingExposure?: boolean;
  exposureAlertType?: "iRequested" | "theyRequested" | "both";
}

export default function ConnectionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { connections, loading, refreshConnections } = useConnections();
  const { connectionLevels } = useLookups();

  const [newConnectionModalVisible, setNewConnectionModalVisible] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<DisplayConnection | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [mySUUID, setMySUUID] = useState<string>("");

  // Collapsible states
  const [bondOpen, setBondOpen] = useState(true);      // level=5
  const [friendOpen, setFriendOpen] = useState(true);  // level=4
  const [flingOpen, setFlingOpen] = useState(true);    // level=3
  const [newOpen, setNewOpen] = useState(true);        // level=2
  const [blockedOpen, setBlockedOpen] = useState(true);// level=1
  const [pendingOpen, setPendingOpen] = useState(true);

  const [forceRender, setForceRender] = useState(0);

  const functionsInstance = getFunctions(firebaseApp);
  const computeHashedIdCF = httpsCallable(functionsInstance, "computeHashedId");
  const updateConnectionStatusCF = useMemo(
    () => httpsCallable(functionsInstance, "updateConnectionStatus"),
    [functionsInstance]
  );

  const { user } = useAuth();
  const { stdis } = useStdis();
  const db = getFirestore(firebaseApp);

  // 1) Compute my SUUID
  useEffect(() => {
    async function fetchMySUUID() {
      if (!user) return;
      try {
        const result = await computeHashedIdCF({ hashType: "standard" });
        setMySUUID(result.data.hashedId);
      } catch (err) {
        console.error("Error computing my SUUID:", err);
      }
    }
    fetchMySUUID();
  }, [user, computeHashedIdCF]);

  // 2) Expire "short-term" connections => New(2) or Fling(3) after 48hrs
  useEffect(() => {
    if (!loading && connections.length > 0) {
      checkAndExpireShortTerm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, connections]);

  async function checkAndExpireShortTerm() {
    const now = Date.now();
    const cutoffMs = now - 48 * 60 * 60 * 1000; // 48 hours

    const updatesNeeded: Array<Promise<any>> = [];

    for (const c of connections) {
      // only if active + level in [2=New, 3=Fling]
      if ([2, 3].includes(c.connectionLevel) && c.connectionStatus === 1 && c.updatedAt) {
        const updatedTime = new Date(c.updatedAt).getTime();
        if (updatedTime < cutoffMs && c.connectionDocId) {
          // Deactivate => status=4
          updatesNeeded.push(
            updateConnectionStatusCF({
              docId: c.connectionDocId,
              newStatus: 4, // e.g. Deactivated
            })
          );
          // also expire any pending doc for that pair
          const pairKey = [c.senderSUUID, c.recipientSUUID].sort().join("_");
          updatesNeeded.push(expireAnyPendingDoc(pairKey));
        }
      }
    }

    if (updatesNeeded.length > 0) {
      try {
        await Promise.all(updatesNeeded);
        await refreshConnections();
        Alert.alert(
          "Expired short-term connections",
          "Some old New/Fling connections have been deactivated."
        );
      } catch (err: any) {
        console.error("Error expiring short-term connections:", err);
      }
    }
  }

  async function expireAnyPendingDoc(pairKey: string) {
    const [s1, s2] = pairKey.split("_");
    try {
      const qPending = query(
        db.collection("connections"),
        where("connectionStatus", "==", 0),
        // pending doc for short-term => level in [2,3]
        where("connectionLevel", "in", [2, 3]),
        where("senderSUUID", "in", [s1, s2]),
        where("recipientSUUID", "in", [s1, s2])
      );
      const snap = await getDocs(qPending);
      if (snap.empty) return;

      const tasks: Array<Promise<any>> = [];
      snap.forEach((docSnap) => {
        tasks.push(
          updateConnectionStatusCF({
            docId: docSnap.id,
            newStatus: 3, // "Expired" or some code
          })
        );
      });
      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
    } catch (err) {
      console.warn("Error expiring pending doc for pair:", pairKey, err);
    }
  }

  // 3) Merge active & pending docs into "displayConnections"
  const displayConnections = useMemo<DisplayConnection[]>(() => {
    function getPairKey(c: Connection) {
      return [c.senderSUUID, c.recipientSUUID].sort().join("_");
    }

    const pairMap = new Map<string, { active?: Connection; pending?: Connection }>();
    // We'll only consider status=0 (pending) or 1 (active)
    const relevant = connections.filter((c) => [0, 1].includes(c.connectionStatus));

    for (const c of relevant) {
      const key = getPairKey(c);
      if (!pairMap.has(key)) {
        pairMap.set(key, {});
      }
      const pairData = pairMap.get(key)!;

      if (c.connectionStatus === 1) {
        pairData.active = c;
      } else {
        pairData.pending = c;
      }
    }

    const result: DisplayConnection[] = [];
    for (const { active, pending } of pairMap.values()) {
      if (active && pending) {
        const pendingLevelName = connectionLevels[String(pending.connectionLevel)]?.name 
          || `Level ${pending.connectionLevel}`;
        const merged: DisplayConnection = {
          ...active,
          pendingDocId: pending.connectionDocId,
          pendingSenderSUUID: pending.senderSUUID,
          pendingRecipientSUUID: pending.recipientSUUID,
          pendingLevelName,
          pendingLevelId: pending.connectionLevel,
        };
        result.push(merged);
      } else if (active) {
        result.push(active);
      } else if (pending) {
        result.push(pending);
      }
    }
    return result;
  }, [connections, connectionLevels]);

  // 4) We used to check "exposureAlertType" or request logic here. 
  // If removing that, you can strip out this entire effect, 
  // or keep if there's some leftover "pending" logic to show the user.

  /**
   * If doc is pending (status=0) and I'm the recipient => I must accept/reject.
   */
  function requiresActionFromMe(c: DisplayConnection): boolean {
    // If we no longer handle exposure requests, skip that portion
    if (c.connectionStatus === 0 && c.recipientSUUID === mySUUID) {
      return true;
    }
    return false;
  }

  // 5) Group them by level if active, or mark as "Pending Requests"
  const {
    blocked,
    newOnes,
    flings,
    friends,
    bonds,
    pendingRequests,
  } = useMemo(() => {
    const blocked: DisplayConnection[] = [];
    const newOnes: DisplayConnection[] = [];
    const flings: DisplayConnection[] = [];
    const friends: DisplayConnection[] = [];
    const bonds: DisplayConnection[] = [];
    const pendingRequests: DisplayConnection[] = [];

    displayConnections.forEach((c) => {
      if (requiresActionFromMe(c)) {
        pendingRequests.push(c);
      } else if (c.connectionStatus === 1) {
        // If it's active, group by c.connectionLevel:
        switch (c.connectionLevel) {
          case 5:
            bonds.push(c);
            break;
          case 4:
            friends.push(c);
            break;
          case 3:
            flings.push(c);
            break;
          case 2:
            newOnes.push(c);
            break;
          case 1:
            blocked.push(c);
            break;
        }
      }
    });

    return { blocked, newOnes, flings, friends, bonds, pendingRequests };
  }, [displayConnections, mySUUID]);

  const isIOS = Platform.OS === "ios";
  const bottomPadding = isIOS ? insets.bottom + 60 : 15;
  const containerStyle = [theme.container, { paddingBottom: bottomPadding }];

  function handlePressConnection(connection: DisplayConnection) {
    setSelectedConnection(connection);
    setDetailsModalVisible(true);
  }

  function renderCollapsibleGroup(
    title: string,
    data: DisplayConnection[],
    isOpen: boolean,
    setIsOpen: (b: boolean) => void
  ) {
    if (!data || data.length === 0) return null;
    const icon = isOpen ? "▼" : "►";

    return (
      <View style={{ marginBottom: 10 }}>
        <TouchableOpacity
          onPress={() => setIsOpen(!isOpen)}
          style={styles.collapsibleHeader}
          activeOpacity={0.8}
        >
          <Text style={styles.groupTitle}>{icon} {title}</Text>
        </TouchableOpacity>

        {isOpen && (
          <View style={{ paddingLeft: 10, marginTop: 5 }}>
            {data.map((item) => (
              <TouchableOpacity
                key={item.connectionDocId || Math.random().toString()}
                activeOpacity={0.7}
                onPress={() => handlePressConnection(item)}
              >
                <ConnectionItem connection={item} mySUUID={mySUUID} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[theme.centerContainer]}>
        <Text style={theme.title}>Loading connections...</Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={theme.title}>Your Connections</Text>

      <FlatList
        data={[]}
        keyExtractor={() => Math.random().toString()}
        renderItem={() => null}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshConnections}
            tintColor={theme.buttonPrimary.backgroundColor}
          />
        }
        ListEmptyComponent={
          <View style={{ paddingBottom: bottomPadding }}>
            {renderCollapsibleGroup("Pending Requests", pendingRequests, pendingOpen, setPendingOpen)}
            {renderCollapsibleGroup("Bonded Partners", bonds, bondOpen, setBondOpen)}
            {renderCollapsibleGroup("Friends", friends, friendOpen, setFriendOpen)}
            {renderCollapsibleGroup("Flings", flings, flingOpen, setFlingOpen)}
            {renderCollapsibleGroup("New", newOnes, newOpen, setNewOpen)}
            {renderCollapsibleGroup("Blocked", blocked, blockedOpen, setBlockedOpen)}

            {pendingRequests.length === 0 &&
             bonds.length === 0 &&
             friends.length === 0 &&
             flings.length === 0 &&
             newOnes.length === 0 &&
             blocked.length === 0 && (
              <View style={{ alignItems: "center", marginTop: 20 }}>
                <Text style={theme.bodyText}>No connections found.</Text>
              </View>
            )}
          </View>
        }
      />

      <ThemedButton
        title="New Connection"
        variant="primary"
        onPress={() => setNewConnectionModalVisible(true)}
      />

      <NewConnection
        visible={newConnectionModalVisible}
        onClose={() => setNewConnectionModalVisible(false)}
      />

      {selectedConnection && (
        <ConnectionDetailsModal
          visible={detailsModalVisible}
          onClose={() => {
            setDetailsModalVisible(false);
            setSelectedConnection(null);
          }}
          connection={selectedConnection}
          isRecipient={selectedConnection.recipientSUUID === mySUUID}
          mySUUID={mySUUID}
          stdis={stdis}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
});
