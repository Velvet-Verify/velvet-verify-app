/* eslint-disable max-len, no-irregular-whitespace, require-jsdoc, @typescript-eslint/no-explicit-any */
// functions/src/connections/updateConnectionLevel.ts
// -----------------------------------------------------------------------------
// Updates the connectionLevel for a given active connection document.
// Handles:
//   • Deactivating the existing connection doc (status 4)
//   • Creating a replacement doc at the new level (status 1)
//   • Rolling over exposure alerts when moving *into* any level ≥ 3.
//       → If prior level ≤3 (brand‑new partnership), deactivate ALL active
//         alerts and create fresh ones for every STDI.  Alerts tied to an
//         already‑positive partner are marked "sent" immediately and the
//         recipient’s healthStatus is updated to Exposed (code 2) per rules.
//       → If prior level ≥4 (ongoing partnership), deactivate current alerts
//         and recreate ONLY the ones we deactivated (no net‑new alerts, no
//         status updates).
// -----------------------------------------------------------------------------

import {onCall, CallableOptions, CallableRequest, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {rollOverAlertsForElevation, PartnerInfo} from "../alerts";
import {STANDARD_HASH_KEY, EXPOSURE_HASH_KEY, HEALTH_HASH_KEY} from "../params";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ---------- types ---------- */
interface Payload {
  docId: string; // existing active connection doc Id
  currentLevel: number; // its current connectionLevel
  newLevel: number; // requested new level
}

/* ---------- callable opts ---------- */
const opts: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY, EXPOSURE_HASH_KEY, HEALTH_HASH_KEY],
};

/* -------------------------------------------------------------------------- */
/*  main callable                                                              */
/* -------------------------------------------------------------------------- */
export const updateConnectionLevel = onCall(opts, async (req: CallableRequest<Payload>) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Auth required");
  const {uid} = req.auth;

  const {docId, currentLevel, newLevel} = (req.data || {}) as any;
  if (!docId || typeof currentLevel !== "number" || typeof newLevel !== "number") {
    throw new HttpsError("invalid-argument", "docId, currentLevel, newLevel are required");
  }
  if (currentLevel === newLevel) return {success: true};

  const connRef = db.collection("connections").doc(docId);
  const tsNow = admin.firestore.FieldValue.serverTimestamp();

  const isElevation = newLevel > currentLevel;
  const newStatus = isElevation ? 0 : 1;

  /* ------------------------------------------------------------------ */
  /* 1. deactivate old doc + create new active doc                       */
  /* ------------------------------------------------------------------ */
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(connRef);
    if (!snap.exists) throw new HttpsError("not-found", "Connection not found");
    const data = snap.data();
    if (!data) throw new HttpsError("internal", "Connection data missing");

    const dup1 = await tx.get(
      db.collection("connections")
        .where("senderSUUID", "==", data.senderSUUID)
        .where("recipientSUUID", "==", data.recipientSUUID)
        .where("connectionLevel", "==", newLevel)
        .where("connectionStatus", "==", 0)
        .limit(1),
    );
    if (!dup1.empty) return;

    const dup2 = await tx.get(
      db.collection("connections")
        .where("recipientSUUID", "==", data.senderSUUID)
        .where("senderSUUID", "==", data.recipientSUUID)
        .where("connectionLevel", "==", newLevel)
        .where("connectionStatus", "==", 0)
        .limit(1),
    );
    if (!dup2.empty) return;

    tx.set(db.collection("connections").doc(), {
      senderSUUID: data.senderSUUID,
      recipientSUUID: data.recipientSUUID,
      connectionLevel: newLevel,
      connectionStatus: newStatus,
      createdAt: tsNow,
      updatedAt: tsNow,
      ...(newStatus === 1 && {connectedAt: tsNow}),
    });
  });

  /* ------------------------------------------------------------------ */
  /* 2. roll‑over alerts if entering level ≥ 3                           */
  /* ------------------------------------------------------------------ */
  if (!isElevation && newLevel >= 3) {
    const callerSUUID = await computeHash("standard", uid);

    const snap = await connRef.get();
    const data = snap.data();
    if (!data) return {success: true};

    const {senderSUUID, recipientSUUID} = data;
    const otherSUUID = senderSUUID === callerSUUID ? recipientSUUID : senderSUUID;
    if (!otherSUUID) return {success: true};

    const [callerES, otherES, callerHS, otherHS] = await Promise.all([
      computeHash("exposure", "", callerSUUID),
      computeHash("exposure", "", otherSUUID),
      computeHash("health", "", callerSUUID),
      computeHash("health", "", otherSUUID),
    ]);

    const callerInfo: PartnerInfo = {suuid: callerSUUID, esuuid: callerES, hsuuid: callerHS};
    const otherInfo: PartnerInfo = {suuid: otherSUUID, esuuid: otherES, hsuuid: otherHS};

    const enteringFromLowerLevel = currentLevel <= 3;
    await rollOverAlertsForElevation(callerInfo, otherInfo, enteringFromLowerLevel, tsNow);
  }

  return {success: true};
});
