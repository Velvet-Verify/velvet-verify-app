// functions/src/exposure/requestExposureAlerts.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {STANDARD_HASH_KEY} from "../params";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface RequestExposureData {
  connectionDocId: string;
}

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY],
};

/**
 * requestExposureAlerts:
 *  - Always stores ESUUID for sender and recipient in the exposureAlerts doc.
 *  - Example usage: user A calls this to request exposure alerts from user B.
 */
export const requestExposureAlerts = onCall(
  callableOptions,
  async (request: CallableRequest<RequestExposureData>) => {
    // 1) Must be authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }

    const {connectionDocId} = request.data;
    if (!connectionDocId) {
      throw new HttpsError("invalid-argument", "Missing connectionDocId.");
    }

    // 2) Identify caller => the one requesting alerts
    const callerUid = request.auth.uid;
    // We'll compute the caller's SUUID to find the connection doc,
    // then compute their ESUUID for storing in exposureAlerts.
    const callerSUUID = await computeHash("standard", callerUid);
    const callerESUUID = await computeHash("exposure", "", callerSUUID);

    // 3) Fetch the connection doc to find the "other" participant
    const connSnap = await db.collection(
      "connections"
    ).doc(connectionDocId).get();
    if (!connSnap.exists) {
      throw new HttpsError("not-found", "Connection doc not found.");
    }
    const connData = connSnap.data() || {};
    const {senderSUUID, recipientSUUID} = connData;

    // 4) Verify the caller is in this connection
    if (callerSUUID !== senderSUUID && callerSUUID !== recipientSUUID) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a participant."
      );
    }

    // The other participant is whichever SUUID is not the caller
    const otherSUUID = callerSUUID === senderSUUID ?
      recipientSUUID : senderSUUID;
    // We'll compute that person's ESUUID,
    // as they're the "sender" in the alert sense
    // (the one who might test positive).
    const otherESUUID = await computeHash("exposure", "", otherSUUID);

    const now = admin.firestore.FieldValue.serverTimestamp();

    // 5) Expire old pending alerts for these two in ESUUID form
    //    (sender=otherESUUID, recipient=callerESUUID, status=0)
    const existingPendingSnap = await db
      .collection("exposureAlerts")
      .where("sender", "==", otherESUUID)
      .where("recipient", "==", callerESUUID)
      .where("status", "==", 0)
      .get();

    const batch = db.batch();
    existingPendingSnap.docs.forEach((alertDoc) => {
      batch.update(alertDoc.ref, {
        status: 5, // e.g. "Expired"
        updatedAt: now,
      });
    });

    // 6) Create new pending alerts (status=0) for each STDI doc
    const stdiSnap = await db.collection("STDI").get();
    stdiSnap.forEach((stdiDoc) => {
      const stdiId = stdiDoc.id; // e.g., "CHLAM"
      const newAlertRef = db.collection("exposureAlerts").doc();
      batch.set(newAlertRef, {
        STDI: stdiId,
        sender: otherESUUID, // store ESUUID from day one
        recipient: callerESUUID, // store ESUUID from day one
        status: 0, // pending
        createdAt: now,
        updatedAt: now,
      });
    });

    // 7) Commit the batch
    await batch.commit();

    return {
      success: true,
      expiredCount: existingPendingSnap.size,
      newCount: stdiSnap.size,
    };
  }
);
