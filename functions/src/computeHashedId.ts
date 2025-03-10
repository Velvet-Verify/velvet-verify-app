// functions/src/computeHashedId.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
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

export type HashType =
  | "standard"
  | "profile"
  | "health"
  | "test"
  | "exposure"
  | "membership";

interface CallableData {
  hashType?: HashType;
  inputSUUID?: string;
}

/**
 * Helper function that computes a hashed ID.
 *
 * If `inputSUUID` is provided and hashType not "standard"), it is used as the
 * base for computing the module-specific hash.
 *
 * @param {HashType} hashType - The type of hash to compute
 * @param {string} rawUid - Raw uid from Firebase Auth when SUUID not provided
 * @param {string} [inputSUUID] - Optional precomputed standard hash
 * @return {Promise<string>} A promise that resolves to the computed hash
 */
export async function computeHash(
  hashType: HashType,
  rawUid: string,
  inputSUUID?: string
): Promise<string> {
  const standardKey = STANDARD_HASH_KEY.value();
  if (!standardKey) {
    throw new HttpsError("failed-precondition", "Standard key not set.");
  }

  let baseHash: string;
  if (hashType === "standard" || !inputSUUID) {
    baseHash = crypto
      .createHmac("sha256", standardKey)
      .update(rawUid)
      .digest("hex");
    if (hashType === "standard") {
      return baseHash;
    }
  } else {
    baseHash = inputSUUID;
  }

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

  const finalHash = crypto
    .createHmac("sha256", moduleKey)
    .update(baseHash)
    .digest("hex");
  console.log(`Computed hash for type ${hashType}: ${finalHash}`);
  return finalHash;
}

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
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }
    const hashType = request.data.hashType;
    if (!hashType) {
      throw new HttpsError("invalid-argument", "Missing or invalid hashType.");
    }
    const rawUid = request.auth.uid;
    const inputSUUID = request.data.inputSUUID;
    const hashedId = await computeHash(hashType, rawUid, inputSUUID);
    return {hashedId};
  }
);
