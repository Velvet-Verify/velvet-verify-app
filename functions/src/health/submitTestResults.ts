// functions/src/health/submitTestResults.ts
/**
 * submitTestResults
 * -----------------
 * Records a user's new STI test results, updates their HealthStatus, rolls
 * negatives to bonded partners, and updates any active exposure‑alert docs.
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
  testDate: string; // ISO
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
 * Cloud‑function entry point.
 *
 * @param {CallableRequest<Payload>} req – incoming request
 * @returns {{ success: boolean }}
 */
export const submitTestResults = onCall(
  opts,
  async (req: CallableRequest<Payload>) => {
    /* ---------- auth / args ---------- */
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Auth required");
    }
    const {uid} = req.auth;
    const results = req.data?.results;
    if (!Array.isArray(results) || results.length === 0) {
      throw new HttpsError("invalid-argument", "results array is required");
    }

    /* ---------- hashes ---------- */
    const suuid = await computeHash("standard", uid);
    const hsuuid = await computeHash("health", "", suuid);
    const esuuid = await computeHash("exposure", "", suuid);

    /* ---------- build lookup ---------- */
    const tested = new Map<string, boolean>();
    results.forEach((r) => tested.set(r.stdiId, r.result));

    /* ---------- write each result ---------- */
    const tsNow = admin.firestore.FieldValue.serverTimestamp();

    for (const r of results) {
      const dateObj = new Date(r.testDate);

      /* audit trail */
      await db.collection("testResults").add({
        STDI: r.stdiId,
        SUUID: suuid,
        result: r.result,
        testDate: dateObj,
        createdAt: tsNow,
      });

      /* upsert HealthStatus */
      const docId = `${hsuuid}_${r.stdiId}`;
      await db
        .collection("healthStatus")
        .doc(docId)
        .set(
          {
            testResult: r.result,
            testDate: dateObj,
          },
          {merge: true},
        );
    }

    /* ---------- inherit negatives ---------- */
    const negatives = results.filter((r) => !r.result);
    if (negatives.length) {
      await inheritNegativesForBondedPartners(suuid, negatives, tsNow);
    }

    /* ---------- update exposure alerts ---------- */
    await updateExposureAlerts(esuuid, tested, tsNow);

    return {success: true};
  },
);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Propagates newly negative results to bonded partners.
 * Stub only - implement your existing logic here.
 *
 * @param {string} _suuid      – caller's SUUID
 * @param {STDIResult[]} _neg  – array of negative results
 * @param {admin.firestore.FieldValue} _ts – server timestamp
 * @return {Promise<void>}
 */
async function inheritNegativesForBondedPartners(
  _suuid: string,
  _neg: STDIResult[],
  _ts: admin.firestore.FieldValue,
): Promise<void> {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  void _suuid;
  void _neg;
  void _ts;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // TODO: implement bonded‑partner inheritance.
}

/**
 * Updates exposureAlert docs: status 2 for positives, 3 for negatives.
 *
 * @param {string} senderESUUID              – caller's exposure SUUID
 * @param {Map<string, boolean>} testedMap   – STDI → test outcome
 * @param {admin.firestore.FieldValue} ts    – server timestamp
 * @return {Promise<void>}
 */
async function updateExposureAlerts(
  senderESUUID: string,
  testedMap: Map<string, boolean>,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (testedMap.size === 0) return;

  const stdiIds = Array.from(testedMap.keys());
  const chunks: string[][] = [];
  while (stdiIds.length) chunks.push(stdiIds.splice(0, 10));

  for (const ids of chunks) {
    const snap = await db
      .collection("exposureAlerts")
      .where("sender", "==", senderESUUID)
      .where("status", "==", 1) // active
      .where("STDI", "in", ids)
      .get();

    let wroteSomething = false;
    const batch = db.batch();

    snap.forEach((d) => {
      const stdi = d.get("STDI") as string;
      const isPos = testedMap.get(stdi) === true;
      const newStatus = isPos ? 2 : 3;
      batch.update(d.ref, {status: newStatus, updatedAt: ts});
      wroteSomething = true;
    });

    if (wroteSomething) {
      await batch.commit();
    }
  }
}
