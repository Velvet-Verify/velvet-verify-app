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
  // Include both keys since we need to compute the profile hash.
  secrets: ["STANDARD_HASH_KEY", "PROFILE_HASH_KEY"],
};

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Extend this interface to include connectionDocId
 */
interface Connection {
  connectionDocId: string; // <-- new: the doc's ID
  displayName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  connectionLevel: number;
  connectionStatus: number;
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

    // Query connections where recipientSUUID equals the user's SUUID
    // and connectionStatus is either 0 (pending) or 1 (accepted).
    const connectionsRef = db.collection("connections");
    const querySnapshot = await connectionsRef
      .where("recipientSUUID", "==", userSUUID)
      .where("connectionStatus", "in", [0, 1])
      .get();

    const connections: Connection[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const senderSUUID: string = data.senderSUUID;

      // Compute the PSUUID using the sender's standard hash.
      // Pass an empty rawUid and the senderSUUID as input => {
      //   computeHash("profile", "", senderSUUID).}
      const psuuid = await computeHash("profile", "", senderSUUID);

      // Query the publicProfile collection using the PSUUID.
      const profileDoc = await db.collection("publicProfile").doc(psuuid).get();
      let displayName: string | null = null;
      let imageUrl: string | null = null;
      if (profileDoc.exists) {
        const profileData = profileDoc.data();
        displayName = profileData?.displayName || null;
        imageUrl = profileData?.imageUrl || null;
      }

      connections.push({
        connectionDocId: docSnap.id, // <--- new field
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
      });
    }
    return connections;
  }
);
