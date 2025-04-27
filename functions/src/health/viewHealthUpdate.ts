// functions/src/health/viewHealthUpdate.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

try {
  admin.app();
} catch {
  admin.initializeApp();
}

export const viewHealthUpdate = functions.https.onCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (data: any, context: any): Promise<{ success: boolean }> => {
    // 1 · Auth check
    if (!context?.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to call viewHealthUpdate."
      );
    }

    // 2 · Validate input
    const {docPath} = data || {};
    if (!docPath || typeof docPath !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "docPath (string) is required."
      );
    }

    const docRef = admin.firestore().doc(docPath);

    // 3 · Flip newAlert → false (idempotent)
    await admin.firestore().runTransaction(async (txn) => {
      const snap = await txn.get(docRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Document ${docPath} does not exist.`
        );
      }
      if (snap.get("newAlert") === false) return; // nothing to do
      txn.set(docRef, {newAlert: false}, {merge: true});
    });

    return {success: true};
  }
);
