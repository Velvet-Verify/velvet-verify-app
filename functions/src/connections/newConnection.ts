// functions/src/newConnection.ts

import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {STANDARD_HASH_KEY} from "../params";

// Create callable options with the secrets included
const callableOptions: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY],
};

/**
 * Computes the SUUID using HMAC-SHA256 from the provided uid.
 *
 * @param {string} uid The user's unique ID from Firebase Auth
 * @return {Promise<string>} A promise resolving to the computed SUUID.
 */
async function computeStandardHash(uid: string): Promise<string> {
  // Retrieve the actual secret value
  const key = STANDARD_HASH_KEY.value();
  if (!key) {
    throw new Error("STANDARD_HASH_KEY is not set in environment variables.");
  }
  return crypto.createHmac("sha256", key).update(uid).digest("hex");
}

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** The shape of data expected from the client when calling newConnection */
interface NewConnectionData {
  email: string;
}

export const newConnection = onCall(callableOptions, async (
  request: CallableRequest<NewConnectionData>
) => {
  console.log("newConnection invoked with data:", request.data);

  // Must be authenticated.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be called while authenticated."
    );
  }
  const senderUid = request.auth.uid;
  console.log("Sender UID:", senderUid);

  // Validate and extract the recipient email.
  const recipientEmail = request.data.email;
  if (!recipientEmail || typeof recipientEmail !== "string") {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  console.log("Looking up recipient by email:", recipientEmail);

  let recipientUser;
  try {
    // Look up the recipient by email in Firebase Auth.
    recipientUser = await admin.auth().getUserByEmail(recipientEmail);
    // console.log("Recipient found. UID:", recipientUser.uid);
    if (recipientUser.uid === senderUid) {
      throw new HttpsError(
        "invalid-argument",
        "Cannot create a connection with yourself."
      );
    }
  } catch (e) {
    console.log("No user found for email:", recipientEmail, "Error:", e);
    // For security, if no user is found, simply return a uniform message.
    return {message: "No matching user found."};
  }
  const recipientUid = recipientUser.uid;

  // Compute SUUIDs for both sender and recipient.
  const senderSUUID = await computeStandardHash(senderUid);
  const recipientSUUID = await computeStandardHash(recipientUid);
  console.log("Computed senderSUUID:", senderSUUID);
  console.log("Computed recipientSUUID:", recipientSUUID);

  // For testing: singular connection expires in 5 minutes.
  const expDate = new Date(Date.now() + 5 * 60 * 1000);

  // Check for existing active or pending connections, regardless of direction.
  const connectionsRef = db.collection("connections");
  console.log("Checking for existing connections...");
  const existingQuery = await connectionsRef
    .where("senderSUUID", "in", [senderSUUID, recipientSUUID])
    .where("recipientSUUID", "in", [senderSUUID, recipientSUUID])
    .where("connectionStatus", "<", 2) // 0=pending,1=active
    .get();

  if (!existingQuery.empty) {
    console.log("Existing connection found.");
    return {message: "An active or pending connection already exists."};
  }

  // Create a new connection record: pending, level=2, with timestamps
  const now = admin.firestore.FieldValue.serverTimestamp();
  const connectionDoc = {
    senderSUUID,
    recipientSUUID,
    connectionStatus: 0, // Pending
    connectionLevel: 2, // e.g. singular
    createdAt: now,
    updatedAt: now, // same as createdAt initially
    expiresAt: admin.firestore.Timestamp.fromDate(expDate),
    // connectedAt => not set until status=1
  };
  console.log("Creating connection document:", connectionDoc);
  await connectionsRef.add(connectionDoc);

  console.log("Connection request created successfully.");
  return {message: "Connection request created successfully."};
});
