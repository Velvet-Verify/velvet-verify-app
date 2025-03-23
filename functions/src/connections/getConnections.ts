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

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface Connection {
  connectionDocId: string;
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
  senderSUUID: string;
  recipientSUUID: string;
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
    // Compute the caller's standard hash (SUUID)
    const userSUUID = await computeHash("standard", request.auth.uid);
    const connectionsRef = db.collection("connections");

    // Accepted connections where the user is the sender.
    const acceptedSenderQuery = await connectionsRef
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", ">=", 2)
      .where("senderSUUID", "==", userSUUID)
      .get();

    // Accepted connections where the user is the recipient.
    const acceptedRecipientQuery = await connectionsRef
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", ">=", 2)
      .where("recipientSUUID", "==", userSUUID)
      .get();

    // Pending connections (status 0) where the user is the recipient.
    const pendingRecipientQuery = await connectionsRef
      .where("connectionStatus", "==", 0)
      .where("connectionLevel", ">=", 2)
      .where("recipientSUUID", "==", userSUUID)
      .get();

    // Combine all the documents from the queries.
    const allDocs = [
      ...acceptedSenderQuery.docs,
      ...acceptedRecipientQuery.docs,
      ...pendingRecipientQuery.docs,
    ];

    // Deduplicate by doc ID
    const uniqueDocsMap = new Map<string, admin
      .firestore
      .QueryDocumentSnapshot>();
    for (const snap of allDocs) {
      uniqueDocsMap.set(snap.id, snap); // if same id occurs, it overwrites
    }
    const docs = Array.from(uniqueDocsMap.values());

    const connections: Connection[] = [];

    // Process each connection document.
    for (const docSnap of docs) {
      const data = docSnap.data();

      // Figure out which SUUID is the other person's
      const remoteSUUID = (userSUUID === data.senderSUUID) ?
        data.recipientSUUID :
        data.senderSUUID;

      // Compute the remote user's PSUUID
      const psuuid = await computeHash(
        "profile", "",
        remoteSUUID
      );
      const profileDoc = await db
        .collection("publicProfile")
        .doc(psuuid)
        .get();

      let displayName: string | null = null;
      let imageUrl: string | null = null;
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        displayName = profileData?.displayName || null;
        imageUrl = profileData?.imageUrl || null;
      }

      connections.push({
        connectionDocId: docSnap.id,
        displayName,
        imageUrl,
        createdAt: data.createdAt ?
          data.createdAt.toDate().toISOString() :
          null,
        expiresAt: data.expiresAt ?
          data.expiresAt.toDate().toISOString() :
          null,
        connectionLevel: data.connectionLevel,
        connectionStatus: data.connectionStatus,
        senderSUUID: data.senderSUUID,
        recipientSUUID: data.recipientSUUID,
      });
    }
    return connections;
  }
);
