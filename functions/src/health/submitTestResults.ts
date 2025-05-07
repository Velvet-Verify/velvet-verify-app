/* eslint-disable max-len, no-irregular-whitespace, require-jsdoc, @typescript-eslint/no-explicit-any */
// functions/src/health/submitTestResults.ts
// v4 – splits statusDate → testDate + testAfter and adds new decision rules

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

/* ─────────────────────────────── TYPES ────────────────────────────── */
interface STDIResult {
  stdiId: string;
  result: boolean; // true  = positive  (→ status 3)
                            // false = negative  (→ status 1)
  testDate: string; // ISO-8601 date string
}
interface Payload { results: STDIResult[] }
interface STDIInfo {
  windowPeriodMax?: number; // days until infection detectable
  treatmentPeriodMin?: number; // days until cure can be verified
}
interface PartnerInfo {
  suuid: string;
  esuuid: string;
  hsuuid: string;
  currentActiveOngoing: boolean;
  lastConnectionDate: Date | null;
}

/* ────────────────────────── CALLABLE OPTIONS ──────────────────────── */
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

/* ──────────────────────────── UTILITIES ───────────────────────────── */
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

/* ─────────── Build map of partner data (level-≥3 connections) ─────── */
async function buildPartnerDirectory(callerSUUID: string): Promise<Map<string, PartnerInfo>> {
  const partnerMap = new Map<string, PartnerInfo>();
  const qBase = db.collection("connections")
    .where("connectionLevel", ">=", 3)
    .where("connectionStatus", "in", [1, 4]);

  const [outSnap, inSnap] = await Promise.all([
    qBase.where("senderSUUID", "==", callerSUUID).get(),
    qBase.where("recipientSUUID", "==", callerSUUID).get(),
  ]);

  function ingest(doc: admin.firestore.QueryDocumentSnapshot) {
    const d = doc.data();
    const peer = d.senderSUUID === callerSUUID ? d.recipientSUUID : d.senderSUUID;
    let info = partnerMap.get(peer);
    const updAt = toJsDate(d.updatedAt);
    const lvl = d.connectionLevel as number;
    const cStat = d.connectionStatus as number;

    if (!info) {
      info = {
        suuid: peer,
        esuuid: "",
        hsuuid: "",
        currentActiveOngoing: false,
        lastConnectionDate: updAt ?? null,
      };
      partnerMap.set(peer, info);
    }
    if (updAt && (!info.lastConnectionDate || updAt > info.lastConnectionDate)) {
      info.lastConnectionDate = updAt;
    }

    if (cStat === 1 && lvl >= 4) info.currentActiveOngoing = true;
  }

  outSnap.forEach(ingest); inSnap.forEach(ingest);

  await Promise.all([...partnerMap.values()].map(async (p) => {
    [p.esuuid, p.hsuuid] = await Promise.all([
      computeHash("exposure", "", p.suuid),
      computeHash("health", "", p.suuid),
    ]);
  }));

  const byES = new Map<string, PartnerInfo>();
  partnerMap.forEach((v) => byES.set(v.esuuid, v));
  return byES;
}

/* ─────────── positive-alert helper (still uses status 2 logic) ────── */
/* (untouched for now – will migrate to exposureDate in the next step)  */
async function applyPositiveAlerts(
  senderSUUID: string,
  positives: Array<{ recipientESUUID: string; stdiId: string }>,
  stdiMeta: Map<string, STDIInfo>,
  serverTS: admin.firestore.FieldValue,
): Promise<void> {
  if (!positives.length) return;

  const partnerDir = await buildPartnerDirectory(senderSUUID);

  for (const {recipientESUUID, stdiId} of positives) {
    const partner = partnerDir.get(recipientESUUID);
    if (!partner) continue;

    const hsRef = db.doc(`healthStatus/${partner.hsuuid}_${stdiId}`);
    const meta = stdiMeta.get(stdiId) || {};

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(hsRef);
      const curStatus = snap.exists ? (snap.get("healthStatus") as number ?? 0) : 0;

      /* Only set to 2 (Exposed) if not already 3 (Positive) */
      if (curStatus === 3) return;

      tx.set(
        hsRef,
        {
          healthStatus: 2,
          // keep earliest exposure logic for now – will revisit when exposureDate lands
          testDate: admin.firestore.Timestamp.now(),
          // compute/refresh testAfter (windowPeriodMax)
          testAfter: meta.windowPeriodMax != null ?
            admin.firestore.Timestamp
              .fromMillis(Date.now() + meta.windowPeriodMax * 864e5) :
            null,
          updatedAt: serverTS,
        },
        {merge: true},
      );
    });
  }
}

/* ──────────────────────── MAIN CALLABLE ───────────────────────────── */
export const submitTestResults = onCall(opts, async (req: CallableRequest<Payload>) => {
  /* ---------- validate auth / payload ---------- */
  if (!req.auth) throw new HttpsError("unauthenticated", "Auth required");
  const {uid} = req.auth;
  const results = req.data?.results;
  if (!Array.isArray(results) || !results.length) {
    throw new HttpsError("invalid-argument", "results array is required");
  }

  const serverTS = admin.firestore.FieldValue.serverTimestamp();

  /* ---------- caller hash IDs ---------- */
  const suuid = await computeHash("standard", uid);
  const hsuuid = await computeHash("health", "", suuid);
  const esuuid = await computeHash("exposure", "", suuid);

  /* ---------- STDI meta lookup ---------- */
  const stdiIds = [...new Set(results.map((r) => r.stdiId))];
  const metaSnaps = await Promise.all(stdiIds.map((id) => db.doc(`STDI/${id}`).get()));
  const stdiMeta = new Map<string, STDIInfo>();
  metaSnaps.forEach((s) => {
    if (s.exists) stdiMeta.set(s.id, s.data() as STDIInfo);
  });

  /* ─────────── 1. persist testResults history ─────────── */
  const tsuuid = await computeHash("test", "", suuid);
  const hist = db.batch();
  results.forEach((r) => hist.set(db.collection("testResults").doc(), {
    TSUUID: tsuuid,
    STDI: r.stdiId,
    result: r.result,
    testDate: new Date(r.testDate),
    createdAt: serverTS,
  }));
  await hist.commit();

  /* ─────────── 2. update healthStatus docs ─────────── */
  const negatives: STDIResult[] = [];
  const resultMap = new Map<string, { result: boolean; testDate: string }>();

  for (const r of results) {
    const docId = `${hsuuid}_${r.stdiId}`;
    const hsRef = db.doc(`healthStatus/${docId}`);
    const isPos = r.result;
    const incomingTS = new Date(r.testDate);
    resultMap.set(r.stdiId, {result: r.result, testDate: r.testDate});
    if (!isPos) negatives.push(r);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(hsRef);
      const curStatus = snap.exists ? (snap.get("healthStatus") as number ?? 0) : 0;
      const curTestDate = snap.exists ? toJsDate(snap.get("testDate")) : null;
      const curTestAfter = snap.exists ? toJsDate(snap.get("testAfter")) : null;

      /* — universal “old sample” guard — */
      if (curStatus !== 0 && curTestDate && incomingTS < curTestDate) return;

      let newStatus = curStatus;
      let writeTest = curTestDate ?? incomingTS; // fallback for brand-new docs
      let writeAfter = curTestAfter ?? null;
      let shouldWrite = false;

      const meta = stdiMeta.get(r.stdiId) || {};
      const windowMax = meta.windowPeriodMax ?? null;
      const treatMin = meta.treatmentPeriodMin ?? null;

      /* --------------- DECISION TREE --------------- */
      switch (curStatus) {
      case 0: /* 0 → 1 / 3 */
      case 1: /* 1 → 3 or 1 */
      case 2: {/* 2 → 3 handled same as 0/1 */
        if (isPos) { // → 3
          newStatus = 3;
          writeTest = incomingTS;
          writeAfter = treatMin != null ? new Date(+incomingTS + treatMin * 864e5) : null;
          shouldWrite = true;
        } else if (curStatus === 0) { // 0 → 1
          newStatus = 1;
          writeTest = incomingTS;
          writeAfter = null;
          shouldWrite = true;
        } else if (curStatus === 1) { // 1 → 1 (refresh date)
          if (!curTestDate || incomingTS >= curTestDate) {
            writeTest = incomingTS;
            shouldWrite = true;
          }
        } else {/* curStatus 2, incoming negative */
          /* Need a testAfter deadline;
               if absent, attempt on-the-fly compute using windowPeriodMax */
          let after = writeAfter;
          if (!after && windowMax != null) {
            // fallback to curTestDate as stand-in for exposureDate until it lands
            after = curTestDate ?
              new Date(+curTestDate + windowMax * 864e5) :
              null;
          }

          if (after && incomingTS >= after) { // clear exposure
            newStatus = 1;
            writeTest = incomingTS;
            writeAfter = null;
            shouldWrite = true;
          } else if (!after) {
            // no valid clearance window yet → only refresh testDate
            writeTest = incomingTS;
            shouldWrite = true;
          }
        }
        break;
      }

      case 3: { // current positive
        if (isPos) { // 3 → 3 (refresh date)
          writeTest = incomingTS;
          shouldWrite = true;
        } else { // 3 → 1 (clear?)
          if (writeAfter && incomingTS >= writeAfter) {
            newStatus = 1;
            writeTest = incomingTS;
            writeAfter = null;
            shouldWrite = true;
          }
        }
        break;
      }

      default: { // any unknown legacy status
        newStatus = isPos ? 3 : 1;
        writeTest = incomingTS;
        writeAfter = isPos && treatMin != null ?
          new Date(+incomingTS + treatMin * 864e5) :
          null;
        shouldWrite = true;
      }
      }

      /* --------------- COMMIT --------------- */
      if (shouldWrite) {
        tx.set(hsRef, {
          healthStatus: newStatus,
          testDate: writeTest,
          testAfter: writeAfter ?? null, // keep the field present
          updatedAt: serverTS,
        }, {merge: true});
      }
    });
  }

  /* ─────────── 3. inherit fresher negatives to bonded partners ────── */
  if (negatives.length) {
    await inheritNegativesForBondedPartners(suuid, negatives, serverTS);
  }

  /* ─────────── 4. update exposureAlert docs (unchanged for now) ───── */
  await updateExposureAlerts(suuid, esuuid, resultMap, stdiMeta, serverTS);

  return {success: true};
});

/* ───────── inherit negatives (status 1) to level-5 partners ───────── */
interface PartnerHealthDoc {
  healthStatus?: number;
  testDate?: admin.firestore.Timestamp | { seconds: number } | string;
}

async function inheritNegativesForBondedPartners(
  callerSUUID: string,
  negatives: STDIResult[],
  serverTS: admin.firestore.FieldValue,
): Promise<void> {
  if (!negatives.length) return;

  /* 1. find level-5 active partners */
  const partners = new Set<string>();
  const [snapA, snapB] = await Promise.all([
    db.collection("connections")
      .where("senderSUUID", "==", callerSUUID)
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", "==", 5).get(),
    db.collection("connections")
      .where("recipientSUUID", "==", callerSUUID)
      .where("connectionStatus", "==", 1)
      .where("connectionLevel", "==", 5).get(),
  ]);
  snapA.forEach((d) => partners.add(d.get("recipientSUUID")));
  snapB.forEach((d) => partners.add(d.get("senderSUUID")));
  if (!partners.size) return;

  /* 2. compute their HSUUIDs */
  const hsMap = new Map<string, string>();
  await Promise.all([...partners].map(async (s) =>
    hsMap.set(s, await computeHash("health", "", s))));

  /* 3. conditional updates */
  const batch = db.batch(); let any = false;
  const ms = (v: any) => {
    const d = toJsDate(v); return d ? d.getTime() : NaN;
  };

  for (const partnerSUUID of partners) {
    const phsuuid = hsMap.get(partnerSUUID);
    if (!phsuuid) continue;

    for (const {stdiId, testDate} of negatives) {
      const ref = db.doc(`healthStatus/${phsuuid}_${stdiId}`);
      const snap = await ref.get();
      if (!snap.exists) continue;

      const data = snap.data() as PartnerHealthDoc;
      if (data.healthStatus !== 1 || !data.testDate) continue;

      if (ms(data.testDate) < new Date(testDate).getTime()) {
        batch.set(ref, {testDate: new Date(testDate), updatedAt: serverTS}, {merge: true});
        any = true;
      }
    }
  }
  if (any) await batch.commit();
}

/* ------------------------------------------------------------------ */
/* Exposure‑alert update helper                                       */
/* ------------------------------------------------------------------ */
async function updateExposureAlerts(
  senderSUUID: string,
  senderESUUID: string,
  testedMap: Map<string, { result: boolean; testDate: string }>,
  stdiMeta: Map<string, STDIInfo>,
  serverTimestamp: admin.firestore.FieldValue,
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
        updatedAt: serverTimestamp,
      });
      if (newStatus === 2) {
        positivesSent.push({recipientESUUID: doc.get("recipient") as string, stdiId: stdi});
      }
    });
  }
  await batch1.commit();

  /* ---------- step 2 : apply positives to recipients ---------- */
  if (positivesSent.length) {
    await applyPositiveAlerts(senderSUUID, positivesSent, stdiMeta, serverTimestamp);
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
  partnerSUUIDs.forEach((su) => {
    const recipES = esCache.get(su);
    if (!recipES) return;
    negatives.forEach((stdi) => {
      batch2.set(db.collection("exposureAlerts").doc(), {
        sender: senderESUUID,
        recipient: recipES,
        STDI: stdi,
        status: 1,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
    });
  });
  await batch2.commit();
}
