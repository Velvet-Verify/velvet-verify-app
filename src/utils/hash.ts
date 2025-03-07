// src/utils/hash.ts
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

const { standardHashKey, profileHashKey, healthHashKey, testHashKey } = Constants.expoConfig?.extra || {};

// Existing functions:
export async function computeSUUID(rawUID: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawUID + standardHashKey
  );
}

export async function computePSUUIDFromSUUID(suuid: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    suuid + profileHashKey
  );
}

// New functions:
export async function computeHSUUIDFromSUUID(suuid: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    suuid + healthHashKey
  );
}

export async function computeTSUUIDFromSUUID(suuid: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    suuid + testHashKey
  );
}
