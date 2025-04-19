// functions/src/connections/updateConnectionLevel.ts
import {
  onCall,
  type CallableRequest,
  type CallableOptions,
  HttpsError,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

import {rollOverAlerts} from "../alerts";
import {computeHash} from "../computeHashedId";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* -------------------------------------------------- */
interface UpdateConnectionLevelData {
  docId: string;
  currentLevel: number;
  newLevel: number;
}
/* -------------------------------------------------- */

const callableOptions: CallableOptions = {
  cors: "*",
  // Only the hashes this function executes:
  secrets: ["STANDARD_HASH_KEY", "EXPOSURE_HASH_KEY"],
};

export const updateConnectionLevel = onCall(
  callableOptions,
  async (request: CallableRequest<UpdateConnectionLevelData>) => {
    /* ---------- 1. auth & args ---------- */
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const {docId, currentLevel, newLevel} = request.data;
    if (!docId || !currentLevel || !newLevel) {
      throw new HttpsError(
        "invalid-argument",
        "Missing docId, currentLevel, or newLevel.",
      );
    }

    /* ---------- 2. basic look‑ups ---------- */
    const callerUid = request.auth.uid;
    const callerSUUID = await computeHash("standard", callerUid);

    const connRef = db.collection("connections").doc(docId);
    const snap = await connRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Doc not found.");

    const oldData = snap.data() as FirebaseFirestore.DocumentData;
    if (oldData.connectionLevel !== currentLevel) {
      throw new HttpsError(
        "failed-precondition",
        "currentLevel mismatch with stored doc.",
      );
    }

    const {senderSUUID: oldSender, recipientSUUID: oldRecipient} = oldData;
    if (callerSUUID !== oldSender && callerSUUID !== oldRecipient) {
      throw new HttpsError(
        "permission-denied",
        "Caller is not in this connection.",
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const otherSUUID = callerSUUID === oldSender ? oldRecipient : oldSender;

    const callerESUUID = await computeHash("exposure", "", callerSUUID);
    const otherESUUID = await computeHash("exposure", "", otherSUUID);

    /* ============================================================ */
    /*                       3. DOWN‑GRADE                          */
    /* ============================================================ */
    if (currentLevel > newLevel) {
      /* 3‑A. deactivate old doc */
      await connRef.update({connectionStatus: 4, updatedAt: now});

      /* 3‑B. create new active doc at lower level */
      await db.collection("connections").add({
        senderSUUID: callerSUUID,
        recipientSUUID: otherSUUID,
        connectionLevel: newLevel,
        connectionStatus: 1,
        createdAt: now,
        updatedAt: now,
        connectedAt: now,
      });

      // 3‑C. roll over alerts if newLevel ≥ 3
      if (newLevel >= 3) {
        await rollOverAlerts(callerESUUID, otherESUUID);
      }

      return {success: true};
    }

    /* ============================================================ */
    /*                      4. UP‑GRADE (pending)                   */
    /* ============================================================ */
    const pendingExists = await db
      .collection("connections")
      .where("connectionLevel", "==", newLevel)
      .where("connectionStatus", "==", 0)
      .where("senderSUUID", "in", [callerSUUID, otherSUUID])
      .where("recipientSUUID", "in", [callerSUUID, otherSUUID])
      .limit(1)
      .get();

    if (pendingExists.empty) {
      await db.collection("connections").add({
        senderSUUID: callerSUUID,
        recipientSUUID: otherSUUID,
        connectionLevel: newLevel,
        connectionStatus: 0, // pending
        createdAt: now,
        updatedAt: now,
      });
    } else {
      console.log("Pending elevation already exists, skipping add.");
    }

    // alerts will be handled when the pending doc is accepted
    return {success: true};
  },
);
