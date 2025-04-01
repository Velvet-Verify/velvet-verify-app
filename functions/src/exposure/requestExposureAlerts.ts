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
  connectionDocId: string; // The ID of the 'connections' doc
  // If you want to pass other flags, e.g. free/premium, do so here
}

/**
 * This function:
 *  1) Validates the caller is a participant in the connection.
 *  2) Finds all STDI IDs in your 'STDI' collection.
 *  3) Creates one doc per STDI in 'exposureAlerts':
 *      - status=0 (Pending)
 *      - sender=the other participant
 *      - recipient=the caller
 *      - createdAt, updatedAt => serverTimestamp
 */
const callableOptions: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY],
};

export const requestExposureAlerts = onCall(
  callableOptions,
  async (request: CallableRequest<RequestExposureData>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }

    const {connectionDocId} = request.data;
    if (!connectionDocId) {
      throw new HttpsError("invalid-argument", "Missing connectionDocId.");
    }

    const callerUid = request.auth.uid;
    // We'll compute the caller's SUUID (standard hash)
    const callerSUUID = await computeHash("standard", callerUid);

    // 1) Fetch the connection doc
    const connSnap = await db.collection(
      "connections"
    ).doc(connectionDocId).get();
    if (!connSnap.exists) {
      throw new HttpsError("not-found", "Connection doc not found.");
    }
    const connData = connSnap.data() || {};

    // Confirm the caller is a participant
    const {senderSUUID, recipientSUUID} = connData;
    if (callerSUUID !== senderSUUID && callerSUUID !== recipientSUUID) {
      throw new HttpsError("permission-denied", "Caller is not a participant.");
    }

    // The "other" user is whichever SUUID is NOT the caller's
    const otherSUUID = (
      callerSUUID === senderSUUID
    ) ? recipientSUUID : senderSUUID;

    // For your usage:
    //  - 'sender' in the exposureAlerts doc = otherSUUID
    //  - 'recipient' in the exposureAlerts doc = callerSUUID
    // That means the user tapping "Request Exposure Alerts" is
    // the 'recipient' of the future alerts.

    // 2) (Optional) If you want to expire older pending or active alerts,
    // do it here: E.g. find any exposureAlerts in the last 48 hours for
    // these participants, set status=5 or do nothing for now.

    // 3) Get all STDI docs (one doc per STDI)
    const stdiSnap = await db.collection("STDI").get();
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 4) For each STDI, create a new doc in 'exposureAlerts'
    // Fields: STDI, sender=otherSUUID, recipient=callerSUUID,
    // status=0, createdAt=..., updatedAt=...
    // We'll store them in a batch for efficiency
    const batch = db.batch();

    stdiSnap.forEach((stdiDoc) => {
      const stdiId = stdiDoc.id; // e.g. "CHLAM"
      const alertRef = db.collection("exposureAlerts").doc();
      batch.set(alertRef, {
        STDI: stdiId,
        sender: otherSUUID,
        recipient: callerSUUID,
        status: 0, // pending
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
    return {success: true, count: stdiSnap.size};
  }
);
