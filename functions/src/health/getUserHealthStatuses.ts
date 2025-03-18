import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {FieldPath} from "firebase-admin/firestore";

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY", "HEALTH_HASH_KEY"],
};

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

export const getUserHealthStatuses = onCall(
  callableOptions,
  async (request: CallableRequest<{ suuid?: string }>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }
    // Use provided suuid if available; otherwise compute from the caller's uid.
    let remoteSUUID = request.data.suuid;
    if (!remoteSUUID) {
      remoteSUUID = await computeHash("standard", request.auth.uid);
    }
    // Compute the health-specific hash (HSUUID) for the remote user.
    const hsUUID = await computeHash("health", "", remoteSUUID);

    // Build a prefix query: all document IDs starting with `${hsUUID}_`
    const prefix = `${hsUUID}_`;
    const querySnapshot = await db
      .collection("healthStatus")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<=", prefix + "\uf8ff")
      .get();

    const statuses: { [stdiId: string]: any } = {};
    querySnapshot.docs.forEach((doc) => {
      // Document IDs are in the format HSUUID_STDID.
      const parts = doc.id.split("_");
      const stdiId = parts.slice(1).join("_");
      statuses[stdiId] = doc.data();
    });
    return {hsUUID, statuses};
  }
);
