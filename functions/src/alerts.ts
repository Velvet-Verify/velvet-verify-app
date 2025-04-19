// functions/src/alerts.ts
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

let cachedSTDIIds: string[] | null = null;

/**
 * Return all STDI document IDs. Uses an in‑memory cache.
*/
async function getSTDIIds(): Promise<string[]> {
  if (cachedSTDIIds) return cachedSTDIIds;
  const docs = await db.collection("STDI").listDocuments();
  cachedSTDIIds = docs.map((d) => d.id);
  return cachedSTDIIds;
}

/**
 * Deactivates all currently *active* (status 1) exposure‑alert documents
 * between the two ESUUIDs and then creates a fresh bidirectional set
 * (status 1) for every STDI in the database.
 *
 * @param {string} esuuidA - ESUUID for user A
 * @param {string} esuuidB - ESUUID for user B
 * @return {Promise<void>} Resolves when the Firestore batch commit finishes.
 */
export async function rollOverAlerts(
  esuuidA: string,
  esuuidB: string,
): Promise<void> {
  const stdiIds = await getSTDIIds();

  // 1. deactivate current active alerts (1 ➜ 3)
  const existing = await db
    .collection("exposureAlerts")
    .where("sender", "in", [esuuidA, esuuidB])
    .where("recipient", "in", [esuuidA, esuuidB])
    .where("status", "==", 1)
    .get();

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  existing.forEach((d) => batch.update(d.ref, {status: 3, updatedAt: now}));

  // 2. fresh bidirectional set
  stdiIds.forEach((stdi) =>
    [
      [esuuidA, esuuidB],
      [esuuidB, esuuidA],
    ].forEach(([s, r]) => {
      const ref = db.collection("exposureAlerts").doc();
      batch.set(ref, {
        STDI: stdi,
        sender: s,
        recipient: r,
        status: 1,
        createdAt: now,
        updatedAt: now,
      });
    }),
  );

  await batch.commit();
}
