import {
  onCall,
  HttpsError,
  CallableRequest,
  CallableOptions,
} from "firebase-functions/v2/https";
import * as crypto from "crypto";
import {
  STANDARD_HASH_KEY,
  PROFILE_HASH_KEY,
  HEALTH_HASH_KEY,
  TEST_HASH_KEY,
  EXPOSURE_HASH_KEY,
  MEMBERSHIP_HASH_KEY,
} from "./params";

type HashType =
  | "standard"
  | "profile"
  | "health"
  | "test"
  | "exposure"
  | "membership";

interface CallableData {
  hashType?: HashType;
}

// For testing, allow all origins and specify our secrets as dependencies.
const callableOptions: CallableOptions = {
  cors: "*",
  secrets: [
    "STANDARD_HASH_KEY",
    "PROFILE_HASH_KEY",
    "HEALTH_HASH_KEY",
    "TEST_HASH_KEY",
    "EXPOSURE_HASH_KEY",
    "MEMBERSHIP_HASH_KEY",
  ],
};

export const computeHashedId = onCall(
  callableOptions,
  async (request: CallableRequest<CallableData>) => {
    // Ensure the request is authenticated.
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }

    // Read hash type from request data.
    const hashType = request.data.hashType;
    if (!hashType) {
      throw new HttpsError(
        "invalid-argument",
        "Missing or invalid hashType."
      );
    }

    // Get the standard key from secrets.
    const standardKey = STANDARD_HASH_KEY.value();
    if (!standardKey) {
      throw new HttpsError("failed-precondition", "Standard key not set.");
    }
    const rawUID = request.auth.uid;

    // Compute the SUUID using HMAC-SHA256 with the standard key.
    const suuid = crypto
      .createHmac("sha256", standardKey)
      .update(rawUID)
      .digest("hex");

    if (hashType === "standard") {
      console.log(`Computed SUUID: ${suuid}`);
      return {hashedId: suuid};
    }

    // Determine the module-specific key.
    let moduleKey: string | undefined;
    switch (hashType) {
    case "profile":
      moduleKey = PROFILE_HASH_KEY.value();
      break;
    case "health":
      moduleKey = HEALTH_HASH_KEY.value();
      break;
    case "test":
      moduleKey = TEST_HASH_KEY.value();
      break;
    case "exposure":
      moduleKey = EXPOSURE_HASH_KEY.value();
      break;
    case "membership":
      moduleKey = MEMBERSHIP_HASH_KEY.value();
      break;
    default:
      throw new HttpsError("invalid-argument", `Invalid hashType: ${hashType}`);
    }
    if (!moduleKey) {
      throw new HttpsError(
        "failed-precondition",
        `Module key for hash type ${hashType} is not set.`
      );
    }

    // Compute the final hash using HMAC-SHA256 with the module-specific key.
    const finalHash = crypto
      .createHmac("sha256", moduleKey)
      .update(suuid)
      .digest("hex");

    console.log(`Computed hash for type ${hashType}: ${finalHash}`);
    return {hashedId: finalHash};
  }
);
