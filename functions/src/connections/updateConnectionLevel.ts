// functions/src/connections/updateConnectionLevel.ts

import {
  onCall,
  type CallableRequest,
  type CallableOptions,
  HttpsError,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface UpdateConnectionLevelData {
  docId: string;
  currentLevel: number;
  newLevel: number;
}

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY", "PROFILE_HASH_KEY"],
};

export const updateConnectionLevel = onCall(callableOptions, async (
  request: CallableRequest<UpdateConnectionLevelData>
) => {
  // Must be authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be called while authenticated."
    );
  }

  const {docId, currentLevel, newLevel} = request.data;
  if (!docId || !currentLevel || !newLevel) {
    throw new HttpsError("invalid-argument",
      "Missing docId, currentLevel, or newLevel."
    );
  }

  const rawUid = request.auth.uid;
  const callerSUUID = await computeHash("standard", rawUid);

  // Get the existing doc
  const connRef = db.collection("connections").doc(docId);
  const snap = await connRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Connection doc not found.");
  }
  const oldData = snap.data() || {};

  // Confirm doc's existing level matches 'currentLevel'
  if (oldData.connectionLevel !== currentLevel) {
    throw new HttpsError(
      "failed-precondition",
      "The doc's connectionLevel does not match the provided currentLevel."
    );
  }

  const oldSender = oldData.senderSUUID;
  const oldRecipient = oldData.recipientSUUID;

  // Figure out the 'other' user
  let otherSUUID: string;
  if (callerSUUID === oldSender) {
    // Caller was the old sender
    otherSUUID = oldRecipient;
  } else if (callerSUUID === oldRecipient) {
    // Caller was the old recipient
    otherSUUID = oldSender;
  } else {
    throw new HttpsError(
      "permission-denied",
      "Caller is not a participant in this connection."
    );
  }

  if (currentLevel > newLevel) {
    // De-escalation logic: mark old doc as deactivated
    await connRef.update({connectionStatus: 4});

    // Check if we already have a doc with (callerSUUID,
    // otherSUUID, newLevel) & status=1
    const checkQuery = await db.collection("connections")
      .where("senderSUUID", "==", callerSUUID)
      .where("recipientSUUID", "==", otherSUUID)
      .where("connectionLevel", "==", newLevel)
      .where("connectionStatus", "==", 1) // active
      .limit(1)
      .get();
    if (!checkQuery.empty) {
      // A doc already exists for that new level => skip creating another
      console.log("De-escalation doc already exists, skipping creation.");
      return {success: true};
    }

    // Otherwise create a new doc with status=1
    await db.collection("connections").add({
      senderSUUID: callerSUUID,
      recipientSUUID: otherSUUID,
      connectionLevel: newLevel,
      connectionStatus: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // ELEVATION logic: do NOT touch the existing doc
    // Instead create a new doc with status=0 (pending)
    // But only if one doesn't exist already for this pair+level.
    const checkQuery = await db.collection("connections")
      .where("connectionLevel", "==", newLevel)
      .where("connectionStatus", "==", 0)
      // We only want one doc for that new level,
      // ignoring direction or concurrency
      // so we check both possible directions:
      .where("senderSUUID", "in", [callerSUUID, otherSUUID])
      .where("recipientSUUID", "in", [callerSUUID, otherSUUID])
      .limit(1)
      .get();

    if (!checkQuery.empty) {
      console.log(
        "Pending doc for this newLevel & participants already exists, skipping."
      );
      return {success: true};
    }

    // Otherwise create a new doc with the caller as sender
    await db.collection("connections").add({
      senderSUUID: callerSUUID,
      recipientSUUID: otherSUUID,
      connectionLevel: newLevel,
      connectionStatus: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {success: true};
});
