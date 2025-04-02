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

interface ExposureAlertDoc {
  STDI: string;
  sender: string;
  recipient: string;
  status: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface RespondExposureData {
  connectionDocId: string; // the same doc from "connections"
  action: "accept" | "decline";
  // or you could do a boolean, or two separate CF functions, etc.
}

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY, EXPOSURE_HASH_KEY],
};

/**
 * This CF is called by the user (the one who might test positive).
 * We find all exposureAlerts with:
 *   sender = that user’s SUUID
 *   recipient = the "other" user’s SUUID
 *   status=0
 * Then we set them to status=1 if accepted, 2 if declined,
 * and we re-hash (sender) / (recipient) fields to anonymize them.
 */
export const respondExposureAlerts = onCall(
  callableOptions,
  async (
    request: CallableRequest<RespondExposureData>
  ) => {
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

    // 1) Verify the caller is part of that connection
    const callerUid = request.auth.uid;
    const callerSUUID = await computeHash(
      "standard",
      callerUid
    );

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
    if (
      callerSUUID !== connData.senderSUUID &&
      callerSUUID !== connData.recipientSUUID
    ) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not a participant of this connection."
      );
    }

    // 2) The "other" user is the one who requested the alerts
    const otherSUUID =
      callerSUUID === connData.senderSUUID ?
        connData.recipientSUUID :
        connData.senderSUUID;

    // 3) We find all exposureAlerts:
    //   sender=callerSUUID (the one who might test positive),
    //   recipient=otherSUUID (the one who requested alerts),
    //   status=0 => pending
    const alertsSnap = await db
      .collection("exposureAlerts")
      .where("sender", "==", callerSUUID)
      .where("recipient", "==", otherSUUID)
      .where("status", "==", 0)
      .get();
    if (alertsSnap.empty) {
      return {
        success: false,
        message: "No pending exposure alerts found.",
      };
    }

    // 4) We'll set them all to 1 (Accepted) or 2 (Declined).
    // Also, we re-hash the doc fields to anonymize them.
    const newStatus = action === "accept" ? 1 : 2;
    const batch = db.batch();

    // For each doc, we:
    //   - re-hash sender => ESUUID
    // If you want to also re-hash recipient on decline => do it
    for (const docSnap of alertsSnap.docs) {
      const data = docSnap.data();
      const docRef = docSnap.ref;

      const oldSenderSUUID = data.sender;
      const oldRecipientSUUID = data.recipient;

      // => Convert them to ESUUID
      const hashedSender = await computeHash(
        "exposure",
        "",
        oldSenderSUUID
      );

      const updateFields: admin.firestore.UpdateData<ExposureAlertDoc> = {
        status: newStatus,
        sender: hashedSender,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (action === "decline") {
        // Also anonymize the recipient if you want to “shred” it
        const hashedRecipient = await computeHash(
          "exposure",
          "",
          oldRecipientSUUID
        );
        updateFields.recipient = hashedRecipient;
      }

      batch.update(docRef, updateFields);
    }

    await batch.commit();

    return {
      success: true,
      count: alertsSnap.size,
      newStatus,
    };
  }
);
