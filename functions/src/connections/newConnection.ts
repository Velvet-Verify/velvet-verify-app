// functions/src/newConnection.ts
/**
 * Cloud Function: newConnection
 * ----------------------------------------------
 * Creates a new Level 2 / Status 0 pending connection.
 * If the caller has an active Level 1 block against the
 * same user can choose to deactivate it first.
 */

import {
  onCall,
  HttpsError,
  CallableRequest,
  CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {STANDARD_HASH_KEY} from "../params";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const callableOpts: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Hash an Auth UID into a 64‑char hex SUUID.
 * @param {string} uid Firebase Auth UID
 * @return {Promise<string>} SUUID
 */
async function toSUUID(uid: string): Promise<string> {
  const key = STANDARD_HASH_KEY.value();
  if (!key) throw new Error("STANDARD_HASH_KEY not set");
  return crypto.createHmac("sha256", key).update(uid).digest("hex");
}

/* ------------------------------------------------------------------ */
/* Callable implementation                                            */
/* ------------------------------------------------------------------ */

interface Payload {
  /** email to connect to */
  email: string;
  /** caller agrees to remove own block first */
  overrideBlock?: boolean;
}

/**
 * newConnection callable entry point.
 *
 * @param {CallableRequest<Payload>} req callable request
 * @returns {{ message: string }}
 */
export const newConnection = onCall(
  callableOpts,
  async (req: CallableRequest<Payload>) => {
    /* ---------- 1. auth & payload ------------------------------------ */
    if (!req.auth) throw new HttpsError("unauthenticated", "Login required");
    const {email, overrideBlock = false} = req.data;
    if (!email || typeof email !== "string") {
      throw new HttpsError("invalid-argument", "Valid email required");
    }

    const senderUid = req.auth.uid.trim();

    /* ---------- 2. lookup recipient ---------------------------------- */
    let recipUid: string;
    try {
      const user = await admin.auth().getUserByEmail(email.trim());
      recipUid = user.uid;
      if (recipUid === senderUid) {
        throw new HttpsError(
          "invalid-argument",
          "Cannot connect to yourself"
        );
      }
    } catch {
      // mask existence of accounts
      return {message: "Request queued"};
    }

    /* ---------- 3. privacy hashes ------------------------------------ */
    const [senderSUUID, recipSUUID] = await Promise.all([
      toSUUID(senderUid),
      toSUUID(recipUid),
    ]);

    /* ---------- 4. duplicate / block checks -------------------------- */
    const dupSnap = await db
      .collection("connections")
      .where("senderSUUID", "in", [senderSUUID, recipSUUID])
      .where("recipientSUUID", "in", [senderSUUID, recipSUUID])
      .where("connectionStatus", "<", 2) // pending or active
      .get();

    const senderBlock = dupSnap.docs.find(
      (d) =>
        d.get("connectionLevel") === 1 &&
        d.get("connectionStatus") === 1 &&
        d.get("senderSUUID") === senderSUUID
    );

    if (senderBlock) {
      if (!overrideBlock) {
        throw new HttpsError("failed-precondition", "blocked-by-sender");
      }
      await senderBlock.ref.update({
        connectionStatus: 4, // deactivated
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (!dupSnap.empty) {
      return {message: "Active or pending connection exists"};
    }

    /* ---------- 5. create pending doc -------------------------------- */
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("connections").add({
      senderSUUID,
      recipientSUUID: recipSUUID,
      connectionLevel: 2, // New
      connectionStatus: 0, // Pending
      createdAt: now,
      updatedAt: now,
      expiresAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ),
    });

    return {message: "Connection request sent"};
  }
);
