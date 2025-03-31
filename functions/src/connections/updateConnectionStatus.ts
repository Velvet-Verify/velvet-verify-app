// functions/src/connections/updateConnectionStatus.ts

import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const callableOptions: CallableOptions = {
  cors: "*",
  // Add any secrets if needed
};

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface UpdateConnectionStatusData {
  docId: string; // e.g. the Firestore document id in "connections"
  newStatus: number; // e.g. 1 => accept, 2 => reject
}

export const updateConnectionStatus = onCall(
  callableOptions,
  async (request: CallableRequest<UpdateConnectionStatusData>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const {docId, newStatus} = request.data;
    if (!docId || typeof newStatus !== "number") {
      throw new HttpsError(
        "invalid-argument",
        "Missing docId or invalid newStatus."
      );
    }

    try {
      const connRef = db.collection("connections").doc(docId);
      const connSnap = await connRef.get();
      if (!connSnap.exists) {
        throw new HttpsError("not-found", "Connection not found.");
      }

      const data = connSnap.data() || {};

      // We'll always set updatedAt
      const now = admin.firestore.FieldValue.serverTimestamp();

      // If newStatus=1 => set connectedAt if not already
      const updateFields: Partial<{
        connectionStatus: number;
        updatedAt: admin.firestore.FieldValue;
        connectedAt: admin.firestore.FieldValue;
      }> = {
        connectionStatus: newStatus,
        updatedAt: now,
      };

      if (newStatus === 1 && !data.connectedAt) {
        // If you only want to set it the first time it becomes active
        updateFields.connectedAt = now;
      }

      // Optionally: verify the caller is allowed to modify.
      // Same logic as updateConnectionLevel.

      await connRef.update(updateFields);

      return {success: true};
    } catch (error: unknown) {
      console.error("updateConnectionStatus error:", error);

      // If it's an Error, grab the message; otherwise use a default.
      const msg =
        error instanceof Error ?
          error.message :
          "Failed to update connection status.";

      throw new HttpsError("unknown", msg);
    }
  }
);
