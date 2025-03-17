// functions/src/connections/updateConnectionStatus.ts

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
  // We need standard + profile secrets if we want to verify sender
  // or recipient by SUUID as well.
  secrets: ["STANDARD_HASH_KEY", "PROFILE_HASH_KEY"],
};

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * We expect data like:
 * {
 *   connectionDocId: string;  // The ID of the 'connections' doc to update
 *   newStatus: number;        // 1 for Accept, 2 for Reject, etc.
 * }
 *
 * We'll also confirm the caller has permission (matches sender or recipient).
 */
interface UpdateConnectionStatusData {
  connectionDocId: string;
  newStatus: number;
}

export const updateConnectionStatus = onCall(
  callableOptions,
  async (request: CallableRequest<UpdateConnectionStatusData>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }

    const {connectionDocId, newStatus} = request.data || {};
    if (!connectionDocId || typeof newStatus !== "number") {
      throw new HttpsError(
        "invalid-argument",
        "Missing connectionDocId or newStatus."
      );
    }

    // Fetch the connection doc
    const connectionRef = db.collection("connections").doc(connectionDocId);
    const connectionSnap = await connectionRef.get();
    if (!connectionSnap.exists) {
      throw new HttpsError("not-found", "Connection document not found.");
    }
    const connectionData = connectionSnap.data();

    // Security check: ensure current user is sender or recipient
    // so they have permission to update the status.
    // We'll compute the user's SUUID to compare.
    const callerUid = request.auth.uid;
    const callerSUUID = await computeHash("standard", callerUid);

    const senderSUUID = connectionData?.senderSUUID;
    const recipientSUUID = connectionData?.recipientSUUID;

    const isAllowed =
      callerSUUID === senderSUUID || callerSUUID === recipientSUUID;

    if (!isAllowed) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to update this connection."
      );
    }

    // Update the connectionStatus field
    await connectionRef.update({
      connectionStatus: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {message: "Connection status updated successfully.", newStatus};
  }
);
