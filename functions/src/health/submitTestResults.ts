// functions/src/health/submitTestResults.ts
/**
 * submitTestResults
 * -------------------------------------------------------
 * Records new STI results, updates HealthStatus, rolls
 * negatives to bonded partners, and updates exposure
 * alerts. When a negative test deactivates an alert and
 * an active level‑4 or level‑5 link exists, a fresh
 * active alert is created.
 */

import {
  onCall,
  HttpsError,
  CallableRequest,
  CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {
  STANDARD_HASH_KEY,
  HEALTH_HASH_KEY,
  MEMBERSHIP_HASH_KEY,
  EXPOSURE_HASH_KEY,
} from "../params";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface STDIResult {
  stdiId: string;
  result: boolean; // true = positive
  testDate: string; // ISO string
}

interface Payload {
  results: STDIResult[];
}

/* ------------------------------------------------------------------ */
/* Callable options                                                   */
/* ------------------------------------------------------------------ */

const opts: CallableOptions = {
  cors: "*",
  secrets: [
    STANDARD_HASH_KEY,
    HEALTH_HASH_KEY,
    MEMBERSHIP_HASH_KEY,
    EXPOSURE_HASH_KEY,
  ],
};

/* ------------------------------------------------------------------ */
/* Main callable                                                      */
/* ------------------------------------------------------------------ */

/**
 * Cloud function entry point.
 *
 * @param {CallableRequest<Payload>} req request
 * @returns {{ success: true }}
 */
export const submitTestResults = onCall(
  opts,
  async (req: CallableRequest<Payload>) => {
    /* ---------- auth & args ---------- */
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required");
    const {uid} = req.auth;
    const results = req.data?.results;
    if (!Array.isArray(results) || results.length === 0) {
      throw new HttpsError("invalid-argument", "results array is required");
    }

    /* ---------- hashes ---------- */
    const suuid = await computeHash("standard", uid);
    const hsuuid = await computeHash("health", "", suuid);
    const esuuid = await computeHash("exposure", "", suuid);

    /* ---------- map of outcomes ---------- */
    const tested = new Map<string, boolean>();
    results.forEach((r) => tested.set(r.stdiId, r.result));
    const tsNow = admin.firestore.FieldValue.serverTimestamp();

    /* ---------- record each result ---------- */
    for (const r of results) {
      const d = new Date(r.testDate);

      await db.collection("testResults").add({
        STDI: r.stdiId,
        SUUID: suuid,
        result: r.result,
        testDate: d,
        createdAt: tsNow,
      });

      await db
        .collection("healthStatus")
        .doc(`${hsuuid}_${r.stdiId}`)
        .set({testResult: r.result, testDate: d}, {merge: true});
    }

    /* ---------- inherit negatives ---------- */
    const negatives = results.filter((r) => !r.result);
    if (negatives.length) {
      await inheritNegativesForBondedPartners(suuid, negatives, tsNow);
    }

    /* ---------- exposure alerts ---------- */
    await updateExposureAlerts(suuid, esuuid, tested, tsNow);

    return {success: true};
  },
);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Propagates newly‑negative results to bonded partners.
 *
 * @param {string} _suuid  caller’s SUUID
 * @param {STDIResult[]} _neg  list of negative results
 * @param {admin.firestore.FieldValue} _ts  server timestamp
 * @return {Promise<void>}
 */
async function inheritNegativesForBondedPartners(
  _suuid: string,
  _neg: STDIResult[],
  _ts: admin.firestore.FieldValue,
): Promise<void> {
  /* TODO: implement bonded‑partner inheritance */
  void _suuid;
  void _neg;
  void _ts;
}

/**
 * Updates exposure‑alert documents.
 *
 * Behaviour
 * ---------
 * •  Positive  → mark any active alert “sent”        (status 2)
 * •  Negative  → mark any active alert “deactivated” (status 3)
 *               and create a fresh **active** alert  (status 1)
 *               for every level‑4 or level‑5 partner,
 *               using the partner’s ESUUID.
 *
 * @param {string} senderSUUID   caller’s standard SUUID
 * @param {string} senderESUUID  caller’s exposure  ESUUID
 * @param {Map<string, boolean>} testedMap   STDI → isPositive
 * @param {admin.firestore.FieldValue} ts    Firestore server timestamp
 * @return {Promise<void>}
 */
async function updateExposureAlerts(
  senderSUUID: string,
  senderESUUID: string,
  testedMap: Map<string, boolean>,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (testedMap.size === 0) return;

  /* ---------- step 1 — update existing active alerts ---------- */
  const ids = Array.from(testedMap.keys());
  const chunks: string[][] = [];
  while (ids.length) chunks.push(ids.splice(0, 10));

  const batch1 = db.batch();
  for (const group of chunks) {
    const snap = await db
      .collection("exposureAlerts")
      .where("sender", "==", senderESUUID)
      .where("status", "==", 1) // active
      .where("STDI", "in", group)
      .get();

    snap.forEach((doc) => {
      const stdi = doc.get("STDI") as string;
      const isPositive = testedMap.get(stdi) === true;
      batch1.update(doc.ref, {status: isPositive ? 2 : 3, updatedAt: ts});
    });
  }
  await batch1.commit();

  /* ---------- step 2 — create fresh alerts for NEGATIVES ---------- */
  const negatives = Array.from(testedMap.entries())
    .filter(([, positive]) => !positive)
    .map(([stdi]) => stdi);

  if (negatives.length === 0) return;

  /* Gather every active level‑4/5 partner (SUUIDs) */
  const partnerSUUIDs = new Set<string>();
  const [snapA, snapB] = await Promise.all([
    db
      .collection("connections")
      .where("senderSUUID", "==", senderSUUID)
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", "in", [4, 5])
      .get(),
    db
      .collection("connections")
      .where("recipientSUUID", "==", senderSUUID)
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", "in", [4, 5])
      .get(),
  ]);
  snapA.forEach((d) => partnerSUUIDs.add(d.get("recipientSUUID")));
  snapB.forEach((d) => partnerSUUIDs.add(d.get("senderSUUID")));
  if (partnerSUUIDs.size === 0) return;

  /* Convert each partner SUUID → ESUUID (cached) */
  const esCache = new Map<string, string>();
  await Promise.all(
    Array.from(partnerSUUIDs).map(async (suid) => {
      const esuid = await computeHash("exposure", "", suid);
      esCache.set(suid, esuid);
    }),
  );

  /* Write fresh alerts */
  const batch2 = db.batch();
  partnerSUUIDs.forEach((suid) => {
    const recipESUUID = esCache.get(suid);
    if (!recipESUUID) return; // safety check
    negatives.forEach((stdi) => {
      batch2.set(db.collection("exposureAlerts").doc(), {
        sender: senderESUUID,
        recipient: recipESUUID,
        STDI: stdi,
        status: 1, // active
        createdAt: ts,
        updatedAt: ts,
      });
    });
  });
  await batch2.commit();
}
