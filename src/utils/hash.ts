// src/utils/hash.ts
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

const { standardHashKey, profileHashKey } = Constants.expoConfig?.extra || {};

// Compute the Standard Hash UID (SUUID) once from the raw UID.
export async function computeSUUID(rawUID: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawUID + standardHashKey
  );
}

// Compute the Profile-specific UID (PSUUID) from the SUUID.
export async function computePSUUIDFromSUUID(suuid: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    suuid + profileHashKey
  );
}
