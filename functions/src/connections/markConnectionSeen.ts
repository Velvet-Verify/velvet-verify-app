// functions/src/connections/markConnectionSeen.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY"],
};

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

interface DataPayload { docId: string }

export const markConnectionSeen = onCall(
  callableOptions,
  async (req: CallableRequest<DataPayload>) => {
    if (!req.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }
    const {docId} = req.data;
    if (!docId) {
      throw new HttpsError("invalid-argument", "Missing docId.");
    }

    const ref = db.collection("connections").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Connection not found.");
    }

    await ref.update({
      newAlert: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {success: true};
  }
);
