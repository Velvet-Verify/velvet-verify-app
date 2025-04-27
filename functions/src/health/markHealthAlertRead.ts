// functions/src/health/markHealthAlertRead.ts
//
// Callable CF that sets   healthStatus/<HSUUID>_<stdiId>.newAlert = false
// ----------------------------------------------------------------------

import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {STANDARD_HASH_KEY, HEALTH_HASH_KEY} from "../params";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

interface Payload {
  stdiId?: string;
}

const opts: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY, HEALTH_HASH_KEY],
};

export const markHealthAlertRead = onCall(
  opts,
  async (req: CallableRequest<Payload>) => {
    // ---------- auth ----------
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    // ---------- args ----------
    const stdiId = (req.data?.stdiId || "").trim();
    if (!stdiId) {
      throw new HttpsError("invalid-argument", "stdiId is required.");
    }

    // ---------- hashes ----------
    const suuid = await computeHash("standard", req.auth.uid);
    const hsuuid = await computeHash("health", "", suuid);

    // ---------- doc ref ----------
    const docRef = db
      .collection("healthStatus")
      .doc(`${hsuuid}_${stdiId}`);

    // ---------- txn ----------
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        throw new HttpsError(
          "not-found",
          `healthStatus document not found for STDI ${stdiId}.`
        );
      }
      if (snap.get("newAlert") === false) return; // already read
      tx.set(docRef, {newAlert: false}, {merge: true});
    });

    return {success: true};
  }
);
