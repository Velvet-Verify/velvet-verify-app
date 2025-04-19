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
    const tested = new Map<string, { result: boolean; testDate: string }>();
    results.forEach((r) =>
      tested.set(r.stdiId, {result: r.result, testDate: r.testDate}),
    );
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
 * Update exposure‑alert documents after the caller submits new
 * test results.
 *
 * Behaviour
 * • Positive – mark any active alert “sent”        (status 2)
 * • Negative – mark any active alert “deactivated” (status 3)
 *              and create a fresh active alert     (status 1)
 *              for every level‑4/5 partner.
 *
 * @param {string} senderSUUID        Caller’s standard SUUID.
 * @param {string} senderESUUID       Caller’s exposure ESUUID.
 * @param {Map<string, Object>} testedMap  Map (STDI id → {
 *                                          result:boolean,
 *                                          testDate:string
 *                                         }).
 * @param {admin.firestore.FieldValue} ts  Firestore server timestamp.
 * @return {Promise<void>}
 */
async function updateExposureAlerts(
  senderSUUID: string,
  senderESUUID: string,
  testedMap: Map<string, { result: boolean; testDate: string }>,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (testedMap.size === 0) return;

  /* ---------- step 1: update any ACTIVE alerts ---------- */
  const stdiIds = Array.from(testedMap.keys());
  const chunks: string[][] = [];
  while (stdiIds.length) chunks.push(stdiIds.splice(0, 10));

  const batch1 = db.batch();
  for (const ids of chunks) {
    const snap = await db
      .collection("exposureAlerts")
      .where("sender", "==", senderESUUID)
      .where("status", "==", 1)
      .where("STDI", "in", ids)
      .get();

    snap.forEach((doc) => {
      const stdi = doc.get("STDI") as string;
      const info = testedMap.get(stdi);
      if (!info) return;
      batch1.update(doc.ref, {
        status: info.result ? 2 : 3,
        testDate: info.testDate,
        updatedAt: ts,
      });
    });
  }
  await batch1.commit();

  /* ---------- step 2 : fresh alerts for NEGATIVES ---------- */
  const negatives = Array.from(testedMap.entries())
    .filter(([, v]) => v.result === false)
    .map(([id]) => id);
  if (negatives.length === 0) return;

  /* level‑4/5 partners (SUUIDs) */
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

  /* translate SUUID → ESUUID (cached) */
  const esCache = new Map<string, string>();
  await Promise.all(
    Array.from(partnerSUUIDs).map(async (s) => {
      esCache.set(s, await computeHash("exposure", "", s));
    }),
  );

  /* write fresh alerts */
  const batch2 = db.batch();
  partnerSUUIDs.forEach((suid) => {
    const recipES = esCache.get(suid);
    if (!recipES) return;
    negatives.forEach((stdi) => {
      batch2.set(db.collection("exposureAlerts").doc(), {
        sender: senderESUUID,
        recipient: recipES,
        STDI: stdi,
        status: 1,
        createdAt: ts,
        updatedAt: ts,
      });
    });
  });
  await batch2.commit();
}
