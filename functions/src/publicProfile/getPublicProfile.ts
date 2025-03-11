// functions/src/publicProfile/getPublicProfile.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY", "PROFILE_HASH_KEY"],
};

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface PublicProfile {
  displayName: string | null;
  imageUrl: string | null;
}

export const getPublicProfile = onCall(
  callableOptions,
  async (
    request: CallableRequest<Record<string, never>>
  ): Promise<PublicProfile> => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }
    // Compute the profile-specific hash (PSUUID) for the caller.
    const psuuid = await computeHash("profile", request.auth.uid);
    // Query the publicProfile collection.
    const profileDoc = await db.collection("publicProfile").doc(psuuid).get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "Public profile not found.");
    }
    const data = profileDoc.data();
    return {
      displayName: data?.displayName || null,
      imageUrl: data?.imageUrl || null,
    };
  }
);
