// functions/src/exposure/respondExposureAlerts.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {STANDARD_HASH_KEY, EXPOSURE_HASH_KEY} from "../params";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface RespondExposureData {
  connectionDocId: string; // which connection they're responding about
  action: "accept" | "decline";
}

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY, EXPOSURE_HASH_KEY],
};

/**
 * respondExposureAlerts:
 *  - The user who might test positive accepts/declines request.
 */
export const respondExposureAlerts = onCall(
  callableOptions,
  async (request: CallableRequest<RespondExposureData>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated."
      );
    }

    const {connectionDocId, action} = request.data;
    if (!connectionDocId || !action) {
      throw new HttpsError(
        "invalid-argument",
        "Missing connectionDocId or action."
      );
    }
    if (!["accept", "decline"].includes(action)) {
      throw new HttpsError(
        "invalid-argument",
        "Action must be 'accept' or 'decline'."
      );
    }

    // 1) Verify the caller is a participant in that connection
    const callerUid = request.auth.uid;
    const callerSUUID = await computeHash("standard", callerUid);

    const connSnap = await db.collection(
      "connections"
    ).doc(connectionDocId).get();
    if (!connSnap.exists) {
      throw new HttpsError("not-found", "Connection doc not found.");
    }
    const connData = connSnap.data() || {};
    if (
      callerSUUID !== connData.senderSUUID &&
      callerSUUID !== connData.recipientSUUID
    ) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a participant."
      );
    }

    // The sender is the ESUUID of the user who might test positive
    // We must find all docs where "sender" = the ESUUID of the caller.
    // who can accept or decline giving exposure.
    const callerESUUID = await computeHash("exposure", "", callerSUUID);

    // The other participant's SUUID
    const otherSUUID =
      callerSUUID === connData.senderSUUID ?
        connData.recipientSUUID :
        connData.senderSUUID;
    const otherESUUID = await computeHash("exposure", "", otherSUUID);

    // 3) Find all exposureAlerts with:
    // sender=callerESUUID, recipient=otherESUUID, status=0
    const alertsSnap = await db
      .collection("exposureAlerts")
      .where("sender", "==", callerESUUID)
      .where("recipient", "==", otherESUUID)
      .where("status", "==", 0) // pending
      .get();

    if (alertsSnap.empty) {
      return {
        success: false,
        message: "No pending exposure alerts found.",
      };
    }

    const newStatus = action === "accept" ? 1 : 2;
    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 4) Update them all to the new status, no re-hash needed
    alertsSnap.forEach((docSnap) => {
      const docRef = docSnap.ref;
      batch.update(docRef, {
        status: newStatus,
        updatedAt: now,
      });
    });

    await batch.commit();

    return {
      success: true,
      count: alertsSnap.size,
      newStatus,
    };
  }
);
