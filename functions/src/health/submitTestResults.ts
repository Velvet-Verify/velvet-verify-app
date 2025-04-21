/* eslint-disable max-len, no-irregular-whitespace, require-jsdoc, @typescript-eslint/no-explicit-any */
// functions/src/health/submitTestResults.ts
/** submitTestResults (v2 - condensed HealthStatus schema)
 * ------------------------------------------------------------------
 * Accepts an array of `{ stdiId, result:boolean, testDate:string }` where
 *   • `result === true`  -> Positive (code 3)
 *   • `result === false` -> Negative (code 1)
 *
 * Business rules implemented (current → incoming):
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ 3 Positive  + Positive  →  history‑only                                     │
 * │ 3 Positive  + Negative  →  if treatmentPeriodMin exists AND                 │
 * │                                 testDate ≥ statusDate + treatmentPeriodMin │
 * │                              ↳ flip to 1 Negative                           │
 * │ 2 Exposed   + Positive  →  always flip to 3 Positive                        │
 * │ 2 Exposed   + Negative  →  if windowPeriodMax exists AND                    │
 * │                                 testDate ≥ statusDate + windowPeriodMax     │
 * │                              ↳ flip to 1 Negative                           │
 * │ 0/1 None/Neg + 1/3       →  if testDate ≥ statusDate (or no statusDate)     │
 * │                              ↳ copy incoming status/date                    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 * Submitting a "Not Tested" (code 0) is filtered out on the client and never
 * reaches this Cloud Function.
 */

import {onCall, HttpsError, CallableRequest, CallableOptions} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {
  STANDARD_HASH_KEY,
  HEALTH_HASH_KEY,
  MEMBERSHIP_HASH_KEY,
  EXPOSURE_HASH_KEY,
  TEST_HASH_KEY,
} from "../params";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface STDIResult {
  stdiId: string;
  result: boolean; // true = positive (3) ; false = negative (1)
  testDate: string; // ISO 8601 date string
}
interface Payload { results: STDIResult[] }
interface STDIInfo {
  windowPeriodMax?: number; // days until infection is detectable
  treatmentPeriodMin?: number; // days until cure can be verified
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
    TEST_HASH_KEY,
  ],
};

/* ------------------------------------------------------------------ */
/* Helper: coerce Firestore Timestamp / JSON → JS Date                */
/* ------------------------------------------------------------------ */
function toJsDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val instanceof admin.firestore.Timestamp) return val.toDate();
  if (typeof val === "object" && typeof val.seconds === "number") {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Main callable                                                      */
/* ------------------------------------------------------------------ */
export const submitTestResults = onCall(opts, async (req: CallableRequest<Payload>) => {
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

  /* ---------- STDI metadata ---------- */
  const stdiIds = Array.from(new Set(results.map((r) => r.stdiId)));
  const metaSnaps = await Promise.all(
    stdiIds.map((id) => db.collection("STDI").doc(id).get()),
  );
  const stdiMeta = new Map<string, STDIInfo>();
  metaSnaps.forEach((snap) => {
    if (snap.exists) stdiMeta.set(snap.id, snap.data() as STDIInfo);
  });

  const tsNow = admin.firestore.FieldValue.serverTimestamp();

  /* ------------------------------------------------------------------ */
  /* 1. persist testResults history                                     */
  /* ------------------------------------------------------------------ */
  // ------------------------------------------------------------------
  // 1. persist testResults history
  // ------------------------------------------------------------------
  // TSUUID = a second‑level hash for individual test history rows
  const tsuuid = await computeHash("test", "", suuid);

  const batchHistory = db.batch();
  results.forEach((r) => {
    batchHistory.set(db.collection("testResults").doc(), {
      TSUUID: tsuuid, // privacy‑preserving id tied to SUUID
      STDI: r.stdiId,
      result: r.result, // true = + , false = −
      testDate: new Date(r.testDate),
      createdAt: tsNow,
    });
  });
  await batchHistory.commit();

  /* ------------------------------------------------------------------ */
  /* 2. update each healthStatus doc via txn                             */
  /* ------------------------------------------------------------------ */
  const negatives: STDIResult[] = [];
  const testedMap = new Map<string, { result: boolean; testDate: string }>();

  for (const r of results) {
    const healthDocId = `${hsuuid}_${r.stdiId}`;
    const healthRef = db.collection("healthStatus").doc(healthDocId);
    const incomingStatus = r.result ? 3 : 1;
    const incomingDate = new Date(r.testDate);
    testedMap.set(r.stdiId, {result: r.result, testDate: r.testDate});

    if (!r.result) negatives.push(r); // collect new negatives for inheritance

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(healthRef);
      const currentStatus: number = snap.exists ? (snap.get("healthStatus") as number) ?? 0 : 0;
      const currentDate : Date | null = snap.exists ? toJsDate(snap.get("statusDate")) : null;

      let shouldUpdate = false;
      let newStatus = currentStatus;
      let newDate = currentDate ?? incomingDate; // default for brand‑new doc

      const meta = stdiMeta.get(r.stdiId) || {};

      switch (currentStatus) {
      case 3: // Positive
        if (incomingStatus === 1 && currentDate && meta.treatmentPeriodMin != null) {
          const clearance = new Date(currentDate);
          clearance.setDate(clearance.getDate() + meta.treatmentPeriodMin);
          if (incomingDate >= clearance) {
            shouldUpdate = true;
            newStatus = 1;
            newDate = incomingDate;
          }
        }
        break;

      case 2: // Exposed
        if (incomingStatus === 3) {
          shouldUpdate = true;
          newStatus = 3;
          newDate = incomingDate;
        } else if (incomingStatus === 1 && currentDate && meta.windowPeriodMax != null) {
          const detectable = new Date(currentDate);
          detectable.setDate(detectable.getDate() + meta.windowPeriodMax);
          if (incomingDate >= detectable) {
            shouldUpdate = true;
            newStatus = 1;
            newDate = incomingDate;
          }
        }
        break;

      case 0: // Not Tested – always adopt incoming
        shouldUpdate = true;
        newStatus = incomingStatus;
        newDate = incomingDate;
        break;
      case 1: // Negative
        if (!currentDate || incomingDate >= currentDate) {
          shouldUpdate = true;
          newStatus = incomingStatus;
          newDate = incomingDate;
        }
        break;
      default:
        if (!currentDate || incomingDate >= currentDate) {
          shouldUpdate = true;
          newStatus = incomingStatus;
          newDate = incomingDate;
        }
      }

      if (shouldUpdate) {
        tx.set(
          healthRef,
          {
            healthStatus: newStatus,
            statusDate: newDate,
            updatedAt: tsNow,
          },
          {merge: true},
        );
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3. propagate fresher negatives to bonded partners                  */
  /* ------------------------------------------------------------------ */
  if (negatives.length) {
    await inheritNegativesForBondedPartners(suuid, negatives, tsNow);
  }

  /* ------------------------------------------------------------------ */
  /* 4. update exposureAlert docs                                       */
  /* ------------------------------------------------------------------ */
  await updateExposureAlerts(suuid, esuuid, testedMap, tsNow);

  return {success: true};
});

/* ------------------------------------------------------------------ */
/* Partner‑inheritance helper                                         */
/* ------------------------------------------------------------------ */
interface PartnerHealthDoc {
  healthStatus?: number;
  statusDate?: admin.firestore.Timestamp | { seconds: number } | string;
}

async function inheritNegativesForBondedPartners(
  callerSUUID: string,
  negatives: STDIResult[],
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (negatives.length === 0) return;

  /* 1️⃣  gather level‑5 partner SUUIDs */
  const partners = new Set<string>();
  const [snapOut, snapIn] = await Promise.all([
    db.collection("connections")
      .where("senderSUUID", "==", callerSUUID)
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", "==", 5)
      .get(),
    db.collection("connections")
      .where("recipientSUUID", "==", callerSUUID)
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", "==", 5)
      .get(),
  ]);
  snapOut.forEach((d) => partners.add(d.get("recipientSUUID")));
  snapIn.forEach((d) => partners.add(d.get("senderSUUID")));
  if (partners.size === 0) return;

  /* 2️⃣  pre‑compute each partner’s HSUUID */
  const hCache = new Map<string, string>();
  await Promise.all(Array.from(partners).map(async (su) => hCache.set(su, await computeHash("health", "", su))));

  /* 3️⃣  conditional updates */
  const batch = db.batch();
  let wrote = false;

  function toMillis(val: any): number {
    const d = toJsDate(val);
    return d ? d.getTime() : NaN;
  }

  for (const partnerSUUID of partners) {
    const partnerHSUUID = hCache.get(partnerSUUID);
    if (!partnerHSUUID) continue;

    for (const {stdiId, testDate} of negatives) {
      const ref = db.collection("healthStatus").doc(`${partnerHSUUID}_${stdiId}`);
      const snap = await ref.get();
      if (!snap.exists) continue;

      const data = snap.data() as PartnerHealthDoc;
      if (data.healthStatus !== 1 || !data.statusDate) continue;

      const prevMs = toMillis(data.statusDate);
      const newMs = new Date(testDate).getTime();
      if (isNaN(prevMs) || prevMs >= newMs) continue;

      batch.set(ref, {statusDate: new Date(testDate), updatedAt: ts}, {merge: true});
      wrote = true;
    }
  }
  if (wrote) await batch.commit();
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
