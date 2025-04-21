/* eslint-disable max-len, no-irregular-whitespace, require-jsdoc, @typescript-eslint/no-explicit-any */
// functions/src/health/submitTestResults.ts
/** submitTestResults (v3 – adds positive‑alert → exposure propagation)
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
 * │                                 testDate ≥ statusDate + windowPeriodMax    │
 * │                              ↳ flip to 1 Negative                           │
 * │ 0/1 None/Neg + 1/3       →  if testDate ≥ statusDate (or no statusDate)     │
 * │                              ↳ copy incoming status/date                    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 * Submitting a "Not Tested" (code 0) is filtered out on the client and never
 * reaches this Cloud Function.
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

interface PartnerInfo {
  suuid: string;
  esuuid: string;
  hsuuid: string;
  currentActiveOngoing: boolean;
  lastConnectionDate: Date | null;
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
/* Helper: build once‑per‑call map of partner info                    */
/* ------------------------------------------------------------------ */
async function buildPartnerDirectory(
  callerSUUID: string
): Promise<Map<string, PartnerInfo>> {
  const partnerMap = new Map<string, PartnerInfo>();

  const qBase = db.collection("connections")
    .where("connectionLevel", ">=", 3)
    .where("connectionStatus", "in", [1, 4]); // active or deactivated

  const [outSnap, inSnap] = await Promise.all([
    qBase.where("senderSUUID", "==", callerSUUID).get(),
    qBase.where("recipientSUUID", "==", callerSUUID).get(),
  ]);

  function ingest(doc: admin.firestore.QueryDocumentSnapshot) {
    const data = doc.data();
    const partnerSUUID: string = data.senderSUUID === callerSUUID ? data.recipientSUUID : data.senderSUUID;
    let info = partnerMap.get(partnerSUUID);
    const updAt = toJsDate(data.updatedAt);
    const level: number = data.connectionLevel;
    const status: number = data.connectionStatus;

    if (!info) {
      info = {
        suuid: partnerSUUID,
        esuuid: "", // to be filled later
        hsuuid: "", // to be filled later
        currentActiveOngoing: false,
        lastConnectionDate: updAt ?? null,
      };
      partnerMap.set(partnerSUUID, info);
    }

    if (updAt && (!info.lastConnectionDate || updAt > info.lastConnectionDate)) {
      info.lastConnectionDate = updAt;
    }

    if (status === 1 && level >= 4) {
      info.currentActiveOngoing = true;
    }
  }

  outSnap.forEach(ingest);
  inSnap.forEach(ingest);

  // compute hash ids (parallel)
  await Promise.all(Array.from(partnerMap.values()).map(async (pi) => {
    [pi.esuuid, pi.hsuuid] = await Promise.all([
      computeHash("exposure", "", pi.suuid),
      computeHash("health", "", pi.suuid),
    ]);
  }));

  // re‑index by ESUUID because alerts store that
  const esMap = new Map<string, PartnerInfo>();
  partnerMap.forEach((v) => esMap.set(v.esuuid, v));
  return esMap;
}

/* ------------------------------------------------------------------ */
/* Helper: apply positive alerts → mark recipient exposed             */
/* ------------------------------------------------------------------ */
async function applyPositiveAlerts(
  senderSUUID: string,
  positives: Array<{ recipientESUUID: string; stdiId: string }>,
  stdiMeta: Map<string, STDIInfo>,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (positives.length === 0) return;

  const partnerDir = await buildPartnerDirectory(senderSUUID);

  // Process each (recipient, STDI) combo in its own txn to avoid batch read limits
  for (const {recipientESUUID, stdiId} of positives) {
    const partner = partnerDir.get(recipientESUUID);
    if (!partner) continue; // not in current/historic L3+ list
    const hsDocId = `${partner.hsuuid}_${stdiId}`;
    const hsRef = db.collection("healthStatus").doc(hsDocId);
    const meta = stdiMeta.get(stdiId) || {};

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(hsRef);
      const curStatus: number = snap.exists ? (snap.get("healthStatus") as number ?? 0) : 0;
      const curDate : Date | null = snap.exists ? toJsDate(snap.get("statusDate")) : null;

      let shouldUpdate = false;
      const newStatus = 2; // Exposed

      switch (curStatus) {
      case 3: // already positive – nothing
        break;
      case 0: // not tested → exposed
      case 2: // already exposed → refresh date
        shouldUpdate = true;
        break;
      case 1: { // negative
        if (partner.currentActiveOngoing) {
          shouldUpdate = true;
        } else {
          const window = meta.windowPeriodMax ?? 0;
          if (window === 0 || !partner.lastConnectionDate) {
            shouldUpdate = true;
          } else {
            const cutoff = new Date(partner.lastConnectionDate);
            cutoff.setDate(cutoff.getDate() + window);
            if (!curDate || curDate < cutoff) shouldUpdate = true;
          }
        }
        break;
      }
      default:
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        tx.set(
          hsRef,
          {
            healthStatus: newStatus,
            statusDate: admin.firestore.Timestamp.now(),
            updatedAt: ts,
          },
          {merge: true},
        );
      }
    });
  }
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
  const tsuuid = await computeHash("test", "", suuid);
  const batchHistory = db.batch();
  results.forEach((r) => {
    batchHistory.set(db.collection("testResults").doc(), {
      TSUUID: tsuuid,
      STDI: r.stdiId,
      result: r.result,
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

    if (!r.result) negatives.push(r);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(healthRef);
      const currentStatus: number = snap.exists ? (snap.get("healthStatus") as number) ?? 0 : 0;
      const currentDate : Date | null = snap.exists ? toJsDate(snap.get("statusDate")) : null;

      let shouldUpdate = false;
      let newStatus = currentStatus;
      let newDate = currentDate ?? incomingDate;

      const meta = stdiMeta.get(r.stdiId) || {};

      switch (currentStatus) {
      case 3:
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
      case 2:
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
      case 0:
        shouldUpdate = true;
        newStatus = incomingStatus;
        newDate = incomingDate;
        break;
      case 1:
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
  await updateExposureAlerts(suuid, esuuid, testedMap, stdiMeta, tsNow);

  return {success: true};
});

/* ------------------------------------------------------------------ */
/* Partner‑inheritance helper (negatives)                              */
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

  /* 1. gather level‑5 partner SUUIDs */
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

  /* 2. pre‑compute each partner’s HSUUID */
  const hCache = new Map<string, string>();
  await Promise.all(Array.from(partners).map(async (su) => hCache.set(su, await computeHash("health", "", su))));

  /* 3. conditional updates */
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

/* ------------------------------------------------------------------ */
/* Exposure‑alert update helper                                       */
/* ------------------------------------------------------------------ */
async function updateExposureAlerts(
  senderSUUID: string,
  senderESUUID: string,
  testedMap: Map<string, { result: boolean; testDate: string }>,
  stdiMeta: Map<string, STDIInfo>,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (testedMap.size === 0) return;

  /* ---------- step 1: update any ACTIVE alerts ---------- */
  const stdiIds = Array.from(testedMap.keys());
  const chunks: string[][] = [];
  while (stdiIds.length) chunks.push(stdiIds.splice(0, 10));

  const batch1 = db.batch();
  const positivesSent: Array<{recipientESUUID: string; stdiId: string}> = [];

  for (const ids of chunks) {
    const snap = await db
      .collection("exposureAlerts")
      .where("sender", "==", senderESUUID)
      .where("status", "==", 1) // active
      .where("STDI", "in", ids)
      .get();

    snap.forEach((doc) => {
      const stdi = doc.get("STDI") as string;
      const info = testedMap.get(stdi);
      if (!info) return;
      const newStatus = info.result ? 2 : 3; // sent or deactivated
      batch1.update(doc.ref, {
        status: newStatus,
        testDate: info.testDate,
        updatedAt: ts,
      });
      if (newStatus === 2) {
        positivesSent.push({recipientESUUID: doc.get("recipient") as string, stdiId: stdi});
      }
    });
  }
  await batch1.commit();

  /* ---------- step 2 : apply positives to recipients ---------- */
  if (positivesSent.length) {
    await applyPositiveAlerts(senderSUUID, positivesSent, stdiMeta, ts);
  }

  /* ---------- step 3 : fresh alerts for NEW NEGATIVES ---------- */
  const negatives = Array.from(testedMap.entries())
    .filter(([, v]) => v.result === false)
    .map(([id]) => id);
  if (negatives.length === 0) return;

  /* level‑4/5 partners */
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

  /* translate SUUID → ESUUID */
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
