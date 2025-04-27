// ============================================================================
// functions/src/connections/updateConnectionLevel.ts
// ----------------------------------------------------------------------------
// Callable Cloud Function that changes a connection’s level.
//
// • Elevations (newLevel > currentLevel)
//   – Keep the current doc active (refresh updatedAt).
//   – Create ONE pending doc at the higher level (connectionStatus = 0).
//   – If a matching pending doc already exists, do nothing.
//
// • Downgrades (newLevel < currentLevel)
//   – Deactivate the current doc (connectionStatus = 4).
//   – Create active replacement doc at the lower level (connectionStatus = 1).
//   – If a matching active doc already exists, just deactivate the higher-level
//     doc and do not create another replacement.
//
// • If downgrading into ≥ level 3, roll over exposure alerts.
// ============================================================================

import {
  onCall,
  type CallableRequest,
  type CallableOptions,
  HttpsError,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {rollOverAlertsForElevation, type PartnerInfo} from "../alerts";
import {
  STANDARD_HASH_KEY,
  EXPOSURE_HASH_KEY,
  HEALTH_HASH_KEY,
} from "../params";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ---------- types ---------- */
interface Payload {
  docId: string;
  currentLevel: number;
  newLevel: number;
}

/* ----------------------------------------------------------------- */
/* Helper                                                            */
/* ----------------------------------------------------------------- */
/**
 * Build the replacement connection document.
 *
 * @param {admin.firestore.DocumentData} data Orig connection doc's data.
 * @param {number} level Target connection level.
 * @param {number} status New `connectionStatus` (0 = pending, 1 = active).
 * @param {admin.firestore.FieldValue} ts FS svr ts for created/updatedAt.
 * @return {Record<string, unknown>} Replacement connection doc ready for FS
 */
function buildReplacement(
  data: admin.firestore.DocumentData,
  level: number,
  status: number,
  ts: admin.firestore.FieldValue,
) {
  return {
    senderSUUID: data.senderSUUID,
    recipientSUUID: data.recipientSUUID,
    connectionLevel: level,
    connectionStatus: status,
    createdAt: ts,
    updatedAt: ts,
    ...(status === 1 && {connectedAt: ts}),
  } as const;
}

/* ---------- callable ---------- */
const opts: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY, EXPOSURE_HASH_KEY, HEALTH_HASH_KEY],
};

export const updateConnectionLevel = onCall(opts, async (
  req: CallableRequest<Payload>,
) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign-in required");

  const {uid} = req.auth;
  const {docId, currentLevel, newLevel} = req.data;
  if (!docId || currentLevel === undefined || newLevel === undefined) {
    throw new HttpsError(
      "invalid-argument",
      "docId, currentLevel and newLevel are required",
    );
  }
  if (currentLevel === newLevel) return {success: true};

  const connRef = db.collection("connections").doc(docId);
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const isElevation = newLevel > currentLevel;
  const callerSUUID = await computeHash("standard", uid);
  const replacementStatus = isElevation ? 0 /* pending */ : 1;

  /* ---------- 2. transaction ---------- */
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(connRef);
    if (!snap.exists) throw new HttpsError("not-found", "Connection missing");
    const data = snap.data() as admin.firestore.DocumentData;

    const otherSUUID =
      callerSUUID === data.senderSUUID ? data.recipientSUUID : data.senderSUUID;

    /* ----- duplicate guards ----- */
    if (isElevation) {
      const dup1 = db.collection("connections")
        .where("senderSUUID", "==", callerSUUID)
        .where("recipientSUUID", "==", otherSUUID)
        .where("connectionLevel", "==", newLevel)
        .where("connectionStatus", "==", 0)
        .limit(1);

      const dup2 = db.collection("connections")
        .where("senderSUUID", "==", otherSUUID)
        .where("recipientSUUID", "==", callerSUUID)
        .where("connectionLevel", "==", newLevel)
        .where("connectionStatus", "==", 0)
        .limit(1);

      const [d1, d2] = await Promise.all([tx.get(dup1), tx.get(dup2)]);
      if (!d1.empty || !d2.empty) {
        // Pending doc already exists → no-op
        return;
      }
    } else {
      const dupA = db.collection("connections")
        .where("senderSUUID", "==", data.senderSUUID)
        .where("recipientSUUID", "==", data.recipientSUUID)
        .where("connectionLevel", "==", newLevel)
        .where("connectionStatus", "==", 1)
        .limit(1);

      const dupB = db.collection("connections")
        .where("senderSUUID", "==", data.recipientSUUID)
        .where("recipientSUUID", "==", data.senderSUUID)
        .where("connectionLevel", "==", newLevel)
        .where("connectionStatus", "==", 1)
        .limit(1);

      const [dA, dB] = await Promise.all([tx.get(dupA), tx.get(dupB)]);
      if (!dA.empty || !dB.empty) {
        // Target level already active → only deactivate current doc
        tx.update(connRef, {connectionStatus: 4, updatedAt: ts});
        return;
      }
    }

    /* ----- update current doc ----- */
    tx.update(connRef, isElevation ?
      {updatedAt: ts} :
      {connectionStatus: 4, updatedAt: ts});

    /* ----- create replacement doc ----- */
    const newDoc = db.collection("connections").doc();
    let payload = buildReplacement(data, newLevel, replacementStatus, ts);

    if (isElevation) {
      payload = {
        ...payload, senderSUUID: callerSUUID,
        recipientSUUID: otherSUUID,
      };
    }

    tx.set(newDoc, payload);
  });

  /* ---------- 3. roll over alerts on downgrade into ≥ 3 ---------- */
  if (!isElevation && newLevel >= 3) {
    const callerSUUID = await computeHash("standard", uid);
    const data = (await connRef.get()).data();
    if (data) {
      const otherSUUID = data.senderSUUID === callerSUUID ?
        data.recipientSUUID :
        data.senderSUUID;

      if (otherSUUID) {
        const [callerES, callerHS, otherES, otherHS] = await Promise.all([
          computeHash("exposure", "", callerSUUID),
          computeHash("health", "", callerSUUID),
          computeHash("exposure", "", otherSUUID),
          computeHash("health", "", otherSUUID),
        ]);

        const callerInfo: PartnerInfo = {
          suuid: callerSUUID,
          esuuid: callerES,
          hsuuid: callerHS,
        };
        const otherInfo: PartnerInfo = {
          suuid: otherSUUID,
          esuuid: otherES,
          hsuuid: otherHS,
        };

        const enteringFromLower = currentLevel <= 3;
        await rollOverAlertsForElevation(
          callerInfo,
          otherInfo,
          enteringFromLower,
          ts,
        );
      }
    }
  }

  return {success: true};
});
