// === functions/src/deleteAccount.ts ===
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Make sure admin is initialised exactly once across your functions bundle
// (If you already call admin.initializeApp() elsewhere, remove the guard.)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Callable that performs the selective‑delete flow and finally removes the
 * Firebase Auth user. It assumes you keep the canonical SUUID on the user
 * document at `users/{uid}.suuid`.
 */
export const deleteAccount = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to delete their account.'
    );
  }

  const uid = context.auth.uid;
  const userSnap = await db.doc(`users/${uid}`).get();
  const suuid = userSnap.data()?.suuid as string | undefined;

  if (!suuid) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'User record missing required suuid.'
    );
  }

  // Helpers ────────────────────────────────────────────────────────────────
  const updateDocs = async (
    colPath: string,
    field: string,
    newStatus: number,
    whereStatuses?: number[]
  ) => {
    const chunks: FirebaseFirestore.WriteBatch[] = [db.batch()];
    let opCount = 0;

    const baseQuery = db.collection(colPath).where(field, '==', suuid);
    const query = whereStatuses?.length
      ? baseQuery.where('status', 'in', whereStatuses)
      : baseQuery;
    const snap = await query.get();

    snap.forEach((doc) => {
      const batch = chunks[chunks.length - 1];
      batch.update(doc.ref, { status: newStatus });
      opCount += 1;
      if (opCount % 450 === 0) {
        // Keep a safety margin under the 500‑mutation limit.
        chunks.push(db.batch());
      }
    });

    await Promise.all(chunks.map((b) => b.commit()));
  };

  const deleteDocs = async (colPath: string, field: string) => {
    const chunks: FirebaseFirestore.WriteBatch[] = [db.batch()];
    let opCount = 0;

    const snap = await db.collection(colPath).where(field, '==', suuid).get();
    snap.forEach((doc) => {
      const batch = chunks[chunks.length - 1];
      batch.delete(doc.ref);
      opCount += 1;
      if (opCount % 450 === 0) {
        chunks.push(db.batch());
      }
    });

    await Promise.all(chunks.map((b) => b.commit()));
  };

  // 1️⃣ Alerts ─ sender or receiver –> status 3 (Deactivated)
  await Promise.all([
    updateDocs('alerts', 'sender', 3),
    updateDocs('alerts', 'receiver', 3),
  ]);

  // 2️⃣ Active connections (status 1) –> status 4 (Deactivated)
  await Promise.all([
    updateDocs('connections', 'sender', 4, [1]),
    updateDocs('connections', 'recipient', 4, [1]),
  ]);

  // 4️⃣ Pending connections (status 2) –> status 3 (Expired)
  await Promise.all([
    updateDocs('connections', 'sender', 3, [2]),
    updateDocs('connections', 'recipient', 3, [2]),
  ]);

  // 3️⃣ Delete public profile
  await db.doc(`publicProfiles/${suuid}`).delete().catch(() => {/* ignore if missing */});

  // 5️⃣ Delete all healthStatus records for this user
  await deleteDocs('healthStatus', 'suuid');

  // ⏹️ Optionally clear any scheduled notifications for this user here.

  // 6️⃣ Finally remove the Firebase Auth account
  await admin.auth().deleteUser(uid);

  return { ok: true };
});
