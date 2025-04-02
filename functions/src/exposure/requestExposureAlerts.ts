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
 * requestExposureAlerts
 *  - Ensures the caller is in the connection
 *  - Expires existing pending alerts (status=0)
 *    between caller & other participant
 *  - Creates new pending alerts (status=0) for each STDI doc
 *
 * The logged-in user (caller) => recipient
 * The other participant => sender
 */
export const requestExposureAlerts = onCall(
  callableOptions, async (
    request: CallableRequest<RequestExposureData>
  ) => {
  // 1) Must be authenticated
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated."
      );
    }

    const {connectionDocId} = request.data;
    if (!connectionDocId) {
      throw new HttpsError(
        "invalid-argument",
        "Missing connectionDocId."
      );
    }

    // 2) Identify caller’s SUUID (the user requesting the alerts = recipient)
    const callerUid = request.auth.uid;
    const callerSUUID = await computeHash(
      "standard",
      callerUid
    );

    // 3) Fetch the connection doc
    const connSnap = await db.collection(
      "connections"
    ).doc(connectionDocId).get();
    if (!connSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Connection doc not found."
      );
    }
    const connData = connSnap.data() || {};
    const {senderSUUID, recipientSUUID} = connData;

    // 4) Verify the caller is in this connection
    if (
      callerSUUID !== senderSUUID && callerSUUID !== recipientSUUID
    ) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a participant."
      );
    }

    // 5) The *other* participant is whichever SUUID is not the caller
    const otherSUUID = (callerSUUID === senderSUUID) ?
      recipientSUUID :
      senderSUUID;

    // So:
    //   sender   = otherSUUID  (the one who might test positive)
    //   recipient= callerSUUID (the one requesting the alerts)
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 6) Expire old pending alerts for these two
    //    where (sender=otherSUUID, recipient=callerSUUID, status=0)
    const existingPendingSnap = await db
      .collection("exposureAlerts")
      .where("sender", "==", otherSUUID)
      .where("recipient", "==", callerSUUID)
      .where("status", "==", 0)
      .get();

    const batch = db.batch();
    existingPendingSnap.docs.forEach((alertDoc) => {
      batch.update(alertDoc.ref, {
        status: 5, // Expired
        updatedAt: now,
      });
    });

    // 7) Create new pending alerts for each STDI doc
    const stdiSnap = await db.collection("STDI").get();
    stdiSnap.forEach((stdiDoc) => {
      const stdiId = stdiDoc.id; // e.g., "CHLAM"
      const newAlertRef = db.collection("exposureAlerts").doc();
      batch.set(newAlertRef, {
        STDI: stdiId,
        sender: otherSUUID,
        recipient: callerSUUID,
        status: 0, // pending
        createdAt: now,
        updatedAt: now,
      });
    });

    // 8) Commit the batch
    await batch.commit();

    return {
      success: true,
      expiredCount: existingPendingSnap.size,
      newCount: stdiSnap.size,
    };
  });
