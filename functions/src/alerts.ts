// functions/src/alerts.ts
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
/** Extra metadata stored on an STDI document. */
export interface STDIInfo {
  windowPeriodMax?: number;
}

/** Convenience bundle of partner‑specific hashed IDs. */
export interface PartnerInfo {
  suuid: string;
  esuuid: string;
  hsuuid: string;
}

/* ------------------------------------------------------------------ */
/* Helper: mark recipients “Exposed” when a positive alert is SENT     */
/* ------------------------------------------------------------------ */
/**
 * Apply “positive” exposure alerts to recipients.
 *
 * @param {PartnerInfo}           sender       positive partner
 * @param {PartnerInfo[]}         recipients   partners receiving alerts
 * @param {string[]}              stdiIds      STDIs that were sent
 * @param {Map<string, STDIInfo>} stdiMeta     meta map (windowPeriodMax, …)
 * @param {admin.firestore.FieldValue} ts      server‑timestamp for writes
 */
async function applyPositiveAlerts(
  sender: PartnerInfo,
  recipients: PartnerInfo[],
  stdiIds: string[],
  stdiMeta: Map<string, STDIInfo>,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (recipients.length === 0) return;

  const batch = db.batch();

  for (const recip of recipients) {
    for (const stdiId of stdiIds) {
      const hsRef = db
        .collection("healthStatus")
        .doc(`${recip.hsuuid}_${stdiId}`);

      const snap = await hsRef.get();
      const curVal = snap.exists ?
        (snap.get("healthStatus") as number ?? 0) :
        0;

      if (curVal === 3) continue; // already positive
      if (curVal === 2) {
        // refresh exposed date
        batch.set(
          hsRef,
          {statusDate: ts, updatedAt: ts},
          {merge: true},
        );
      } else {
        // 0 or 1 → Exposed
        batch.set(
          hsRef,
          {healthStatus: 2, statusDate: ts, updatedAt: ts},
          {merge: true},
        );
      }
    }
  }

  await batch.commit();
}

/* ------------------------------------------------------------------ */
/* Main helper: roll over alerts on elevation                          */
/* ------------------------------------------------------------------ */
/**
 * Roll over exposure alerts when a pair is elevated to ≥ level 3.
 *
 * @param {PartnerInfo}           caller                   caller bundle
 * @param {PartnerInfo}           other                    other user bundle
 * @param {boolean}               enteringFromLowerLevel   true if prior ≤ 3
 * @param {admin.firestore.FieldValue} ts                  server timestamp
 */
export async function rollOverAlertsForElevation(
  caller: PartnerInfo,
  other: PartnerInfo,
  enteringFromLowerLevel: boolean,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  /* ---------- 1. deactivate active alerts ---------- */
  const activeSnap = await db
    .collection("exposureAlerts")
    .where("status", "==", 1)
    .where("sender", "in", [caller.esuuid, other.esuuid])
    .get();

  const batch = db.batch();
  const deactivatedSTDIs = new Set<string>();

  activeSnap.forEach((d) => {
    const recip = d.get("recipient");
    if (recip === caller.esuuid || recip === other.esuuid) {
      batch.update(d.ref, {status: 3, updatedAt: ts});
      deactivatedSTDIs.add(d.get("STDI") as string);
    }
  });

  /* ---------- 2. choose which STDIs to recreate ---------- */
  let recreateSTDIs: string[];
  if (enteringFromLowerLevel) {
    const all = await db.collection("STDI").get();
    recreateSTDIs = all.docs.map((d) => d.id);
  } else {
    recreateSTDIs = Array.from(deactivatedSTDIs);
  }

  /* ---------- 3. fetch STDI meta + positive lists ---------- */
  const metaMap = new Map<string, STDIInfo>();
  await Promise.all(
    recreateSTDIs.map(async (id) => {
      const doc = await db.collection("STDI").doc(id).get();
      if (doc.exists) metaMap.set(id, doc.data() as STDIInfo);
    }),
  );

  const callerPos: string[] = [];
  const otherPos: string[] = [];

  if (enteringFromLowerLevel) {
    const fetches: Promise<void>[] = recreateSTDIs.map(async (id) => {
      const [cSnap, oSnap] = await Promise.all([
        db.doc(`healthStatus/${caller.hsuuid}_${id}`).get(),
        db.doc(`healthStatus/${other.hsuuid}_${id}`).get(),
      ]);
      if (cSnap.exists && cSnap.get("healthStatus") === 3) callerPos.push(id);
      if (oSnap.exists && oSnap.get("healthStatus") === 3) otherPos.push(id);
    });
    await Promise.all(fetches);
  }

  /* ---------- 4. create new alerts ---------- */
  recreateSTDIs.forEach((stdiId) => {
    const callerPositive = callerPos.includes(stdiId);
    const otherPositive = otherPos.includes(stdiId);

    batch.set(db.collection("exposureAlerts").doc(), {
      sender: caller.esuuid,
      recipient: other.esuuid,
      STDI: stdiId,
      status: callerPositive ? 2 : 1,
      createdAt: ts,
      updatedAt: ts,
    });

    batch.set(db.collection("exposureAlerts").doc(), {
      sender: other.esuuid,
      recipient: caller.esuuid,
      STDI: stdiId,
      status: otherPositive ? 2 : 1,
      createdAt: ts,
      updatedAt: ts,
    });
  });

  await batch.commit();

  /* ---------- 5. propagate “SENT” positives ---------- */
  if (enteringFromLowerLevel) {
    const jobs: Promise<void>[] = [];

    if (callerPos.length) {
      jobs.push(
        applyPositiveAlerts(caller, [other], callerPos, metaMap, ts),
      );
    }
    if (otherPos.length) {
      jobs.push(
        applyPositiveAlerts(other, [caller], otherPos, metaMap, ts),
      );
    }

    await Promise.all(jobs);
  }
}
