/* ========================================================================== */
/* 1. alerts.ts                                                               */
/* ========================================================================== */
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** Extra metadata on an STDI document. */
export interface STDIInfo {
  /** Days until infection is detectable. */
  windowPeriodMax?: number;
}

/** Partner‑specific hashed identifiers. */
export interface PartnerInfo {
  suuid: string;
  esuuid: string;
  hsuuid: string;
}

/**
 * Flip or refresh recipients to **Exposed (2)** when a positive exposure
 * alert is sent. Also sets `newAlert:true` so the partner sees an unread
 * indicator.
 *
 * @param {PartnerInfo} sender      The positive partner.
 * @param {PartnerInfo[]} recipients Partners receiving alerts.
 * @param {string[]} stdiIds        List of STDI IDs sent.
 * @param {Map<string, STDIInfo>} stdiMeta Map of STDI metadata.
 * @param {admin.firestore.FieldValue} ts Firestore server timestamp.
 * @return {Promise<void>} Promise that resolves once batch commit finishes.
 */
export async function applyPositiveAlerts(
  sender: PartnerInfo,
  recipients: PartnerInfo[],
  stdiIds: string[],
  stdiMeta: Map<string, STDIInfo>, // kept for future window logic
  ts: admin.firestore.FieldValue,
): Promise<void> {
  if (recipients.length === 0 || stdiIds.length === 0) return;

  const batch = db.batch();

  for (const recip of recipients) {
    for (const stdiId of stdiIds) {
      const hsRef = db
        .collection("healthStatus")
        .doc(`${recip.hsuuid}_${stdiId}`);

      const snap = await hsRef.get();
      const curStatus = snap.exists ?
        (snap.get("healthStatus") as number) ?? 0 :
        0;

      // Skip if already positive.
      if (curStatus === 3) continue;

      const basePatch = {
        statusDate: ts,
        updatedAt: ts,
        newAlert: true,
      } as const;

      if (curStatus === 2) {
        batch.set(hsRef, basePatch, {merge: true});
      } else {
        batch.set(
          hsRef,
          {...basePatch, healthStatus: 2},
          {merge: true},
        );
      }
    }
  }

  await batch.commit();
}

/**
 * Re‑creates exposure alerts when a connection elevates into any level ≥ 3.
 * Positives are propagated via {@link applyPositiveAlerts} so the recipientʼs
 * status flips to **Exposed** with `newAlert:true`.
 *
 * @param {PartnerInfo} caller               The user initiating elevation.
 * @param {PartnerInfo} other                The opposite partner.
 * @param {boolean} enteringFromLowerLevel   Was previous level ≤ 3.
 * @param {admin.firestore.FieldValue} ts    Firestore server timestamp.
 * @return {Promise<void>} Promise that resolves after all writes finish.
 */
export async function rollOverAlertsForElevation(
  caller: PartnerInfo,
  other: PartnerInfo,
  enteringFromLowerLevel: boolean,
  ts: admin.firestore.FieldValue,
): Promise<void> {
  // -- 1. deactivate current active alerts -- //
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

  // -- 2. decide which STDIs to recreate -- //
  const recreateSTDIs = enteringFromLowerLevel ?
    (await db.collection("STDI").get()).docs.map((d) => d.id) :
    Array.from(deactivatedSTDIs);

  // -- 3. gather meta + current positives -- //
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
    await Promise.all(
      recreateSTDIs.map(async (id) => {
        const [cSnap, oSnap] = await Promise.all([
          db.doc(`healthStatus/${caller.hsuuid}_${id}`).get(),
          db.doc(`healthStatus/${other.hsuuid}_${id}`).get(),
        ]);
        if (cSnap.exists && cSnap.get("healthStatus") === 3) callerPos.push(id);
        if (oSnap.exists && oSnap.get("healthStatus") === 3) otherPos.push(id);
      }),
    );
  }

  // -- 4. create fresh alerts -- //
  recreateSTDIs.forEach((sid) => {
    const callerPositive = callerPos.includes(sid);
    const otherPositive = otherPos.includes(sid);

    batch.set(db.collection("exposureAlerts").doc(), {
      sender: caller.esuuid,
      recipient: other.esuuid,
      STDI: sid,
      status: callerPositive ? 2 : 1,
      createdAt: ts,
      updatedAt: ts,
    });

    batch.set(db.collection("exposureAlerts").doc(), {
      sender: other.esuuid,
      recipient: caller.esuuid,
      STDI: sid,
      status: otherPositive ? 2 : 1,
      createdAt: ts,
      updatedAt: ts,
    });
  });

  await batch.commit();

  // -- 5. propagate positive exposures -- //
  if (enteringFromLowerLevel) {
    await Promise.all([
      callerPos.length &&
        applyPositiveAlerts(caller, [other], callerPos, metaMap, ts),
      otherPos.length &&
        applyPositiveAlerts(other, [caller], otherPos, metaMap, ts),
    ]);
  }
}
