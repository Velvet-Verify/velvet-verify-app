// functions/src/connections/updateConnectionStatus.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

import {rollOverAlertsForElevation} from "../alerts";
import {computeHash} from "../computeHashedId";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* -------------------------------------------------- */
interface UpdateConnectionStatusData {
  docId: string;
  newStatus: number; // 1 accept · 2 reject · etc.
}
/* -------------------------------------------------- */

const callableOptions: CallableOptions = {
  cors: "*",
  // hashes executed in this function:
  secrets: ["STANDARD_HASH_KEY", "EXPOSURE_HASH_KEY", "HEALTH_HASH_KEY"],
};

export const updateConnectionStatus = onCall(
  callableOptions,
  async (request: CallableRequest<UpdateConnectionStatusData>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }

    const {docId, newStatus} = request.data;
    if (!docId || typeof newStatus !== "number") {
      throw new HttpsError("invalid-argument", "Missing docId or newStatus.");
    }

    /* ---------- fetch doc ---------- */
    const connRef = db.collection("connections").doc(docId);
    const connSnap = await connRef.get();
    if (!connSnap.exists) {
      throw new HttpsError("not-found", "Connection not found.");
    }

    const data = connSnap.data() as FirebaseFirestore.DocumentData;
    const now = admin.firestore.FieldValue.serverTimestamp();

    /* ---------- update fields ---------- */
    const updateFields: Partial<{
      connectionStatus: number;
      updatedAt: FirebaseFirestore.FieldValue;
      connectedAt: FirebaseFirestore.FieldValue;
    }> = {
      connectionStatus: newStatus,
      updatedAt: now,
    };

    /* ---------- accept logic ---------- */
    if (newStatus === 1) {
      if (!data.connectedAt) updateFields.connectedAt = now;

      if (data.connectionLevel >= 3) {
        const [senderES, recipES, senderHS, recipHS] = await Promise.all([
          computeHash("exposure", "", data.senderSUUID),
          computeHash("exposure", "", data.recipientSUUID),
          computeHash("health", "", data.senderSUUID),
          computeHash("health", "", data.recipientSUUID),
        ]);

        const senderInfo = {
          suuid: data.senderSUUID,
          esuuid: senderES,
          hsuuid: senderHS,
        };
        const recipInfo = {
          suuid: data.recipientSUUID,
          esuuid: recipES,
          hsuuid: recipHS,
        };

        const enteringFromLower = data.connectionLevel <= 3;
        await rollOverAlertsForElevation(
          senderInfo,
          recipInfo,
          enteringFromLower,
          now
        );
      }

      const lowerActiveA = db
        .collection("connections")
        .where("senderSUUID", "==", data.senderSUUID)
        .where("recipientSUUID", "==", data.recipientSUUID)
        .where("connectionLevel", "<", data.connectionLevel)
        .where("connectionStatus", "==", 1)
        .get();

      const lowerActiveB = db
        .collection("connections")
        .where("senderSUUID", "==", data.recipientSUUID)
        .where("recipientSUUID", "==", data.senderSUUID)
        .where("connectionLevel", "<", data.connectionLevel)
        .where("connectionStatus", "==", 1)
        .get();

      const snapList = await Promise.all([lowerActiveA, lowerActiveB]);

      const batch = db.batch();
      snapList.forEach((s) =>
        s.docs.forEach((d) =>
          batch.update(d.ref, {connectionStatus: 4, updatedAt: now}),
        ),
      );
      await batch.commit();
    }

    await connRef.update(updateFields);
    return {success: true};
  },
);
