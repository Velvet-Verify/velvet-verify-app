import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as crypto from "crypto";

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

export const computeHashedId = onCall(
  (request: CallableRequest<CallableData>) => {
    const hashConfig = functions.config().hash;
    if (!hashConfig) {
      throw new HttpsError(
        "failed-precondition",
        "Hash configuration is not set."
      );
    }
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }

    const hashType = request.data.hashType;
    if (!hashType) {
      throw new HttpsError(
        "invalid-argument",
        "Missing or invalid hashType."
      );
    }

    const rawUID = request.auth.uid;
    const standardKey = hashConfig.standard;
    if (!standardKey) {
      throw new HttpsError(
        "failed-precondition",
        "Standard key not set."
      );
    }

    const suuid = crypto
      .createHmac("sha256", standardKey)
      .update(rawUID)
      .digest("hex");

    if (hashType === "standard") {
      console.log(`Computed SUUID: ${suuid}`);
      return {hashedId: suuid};
    }

    let moduleKey: string|undefined;
    switch (hashType) {
    case "profile":
      moduleKey = hashConfig.profile;
      break;
    case "health":
      moduleKey = hashConfig.health;
      break;
    case "test":
      moduleKey = hashConfig.test;
      break;
    case "exposure":
      moduleKey = hashConfig.exposure;
      break;
    case "membership":
      moduleKey = hashConfig.membership;
      break;
    default:
      throw new HttpsError(
        "invalid-argument",
        `Invalid hashType: ${hashType}`
      );
    }
    if (!moduleKey) {
      throw new HttpsError(
        "failed-precondition",
        `Module key for hash type ${hashType} is not set.`
      );
    }

    const finalHash = crypto
      .createHmac("sha256", moduleKey)
      .update(suuid)
      .digest("hex");

    console.log(`Computed hash for type ${hashType}: ${finalHash}`);
    return {hashedId: finalHash};
  }
);
