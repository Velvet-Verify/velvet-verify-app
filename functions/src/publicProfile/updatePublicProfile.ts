// functions/src/publicProfile/updatePublicProfile.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const opts: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY", "PROFILE_HASH_KEY"],
};

interface Payload { displayName: string; imageUrl: string }

export const updatePublicProfile = onCall(opts,
  async (req: CallableRequest<Payload>) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }
    const {displayName, imageUrl} = req.data;
    if (!displayName) {
      throw new HttpsError("invalid-argument", "Missing displayName.");
    }

    const psuuid = await computeHash("profile", req.auth.uid);
    await db.collection("publicProfile").doc(psuuid).set(
      {displayName, imageUrl}, {merge: true}
    );

    return {success: true};
  }
);
