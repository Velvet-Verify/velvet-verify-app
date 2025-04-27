// functions/src/connections/getConnections.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY", "PROFILE_HASH_KEY"],
};

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ---------- return type ---------- */
interface Connection {
  connectionDocId: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
  senderSUUID: string;
  recipientSUUID: string;
  newAlert?: boolean;
}

export const getConnections = onCall(
  callableOptions,
  async (
    request: CallableRequest<Record<string, never>>
  ): Promise<Connection[]> => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }

    /* ---------- caller’s SUUID ---------- */
    const userSUUID = await computeHash("standard", request.auth.uid);
    const connectionsRef = db.collection("connections");

    /* ---------- queries (unchanged) ---------- */
    const [
      acceptedSenderQuery,
      acceptedRecipientQuery,
      pendingRecipientQuery,
      pendingSenderQuery,
    ] = await Promise.all([
      connectionsRef
        .where("connectionStatus", "==", 1)
        .where("connectionLevel", ">=", 2)
        .where("senderSUUID", "==", userSUUID)
        .get(),
      connectionsRef
        .where("connectionStatus", "==", 1)
        .where("connectionLevel", ">=", 2)
        .where("recipientSUUID", "==", userSUUID)
        .get(),
      connectionsRef
        .where("connectionStatus", "==", 0)
        .where("connectionLevel", ">=", 2)
        .where("recipientSUUID", "==", userSUUID)
        .get(),
      connectionsRef
        .where("connectionStatus", "==", 0)
        .where("connectionLevel", ">=", 3)
        .where("senderSUUID", "==", userSUUID)
        .get(),
    ]);

    /* ---------- combine & dedupe ---------- */
    const allDocs = [
      ...acceptedSenderQuery.docs,
      ...acceptedRecipientQuery.docs,
      ...pendingRecipientQuery.docs,
      ...pendingSenderQuery.docs,
    ];
    const unique = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    allDocs.forEach((d) => unique.set(d.id, d));
    const docs = Array.from(unique.values());

    /* ---------- build results ---------- */
    const connections: Connection[] = [];

    for (const docSnap of docs) {
      const data = docSnap.data();

      /* remote user’s display / avatar */
      const remoteSUUID = userSUUID === data.senderSUUID ?
        data.recipientSUUID :
        data.senderSUUID;
      const psuuid = await computeHash("profile", "", remoteSUUID);
      const profileDoc = await db.collection("publicProfile").doc(psuuid).get();

      let displayName: string | null = null;
      let imageUrl: string | null = null;
      if (profileDoc.exists) {
        displayName = profileDoc.get("displayName") || null;
        imageUrl = profileDoc.get("imageUrl") || null;
      }

      connections.push({
        connectionDocId: docSnap.id,
        displayName,
        imageUrl,
        createdAt: data.createdAt ?
          data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt ?
          data.updatedAt.toDate().toISOString() : null,
        expiresAt: data.expiresAt ?
          data.expiresAt.toDate().toISOString() : null,
        connectionLevel: data.connectionLevel,
        connectionStatus: data.connectionStatus,
        senderSUUID: data.senderSUUID,
        recipientSUUID: data.recipientSUUID,
        newAlert: data.newAlert === true ? true : undefined,
      });
    }

    return connections;
  }
);
