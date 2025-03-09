// src/utils/hash.ts
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { getAuth } from 'firebase/auth';

const {
  standardHashKey,
  profileHashKey,
  healthHashKey,
  testHashKey,
  exposureHashKey,
  membershipHashKey,
} = Constants.expoConfig?.extra || {};

export type HashType = 'standard' | 'profile' | 'health' | 'test' | 'exposure' | 'membership';

export async function computeHashedId(hashType: HashType): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not logged in');
  }
  const rawUID = user.uid;

  if (hashType === 'standard') {
    if (!standardHashKey) throw new Error('Standard hash key not defined');
    // For the standard hash, we use the raw UID.
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawUID + standardHashKey
    );
  } else {
    // For other hash types, we first compute the SUUID.
    if (!standardHashKey) throw new Error('Standard hash key not defined');
    const suuid = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawUID + standardHashKey
    );

    // Then pick the appropriate module-specific key.
    let moduleKey: string | undefined;
    switch (hashType) {
      case 'profile':
        moduleKey = profileHashKey;
        break;
      case 'health':
        moduleKey = healthHashKey;
        break;
      case 'test':
        moduleKey = testHashKey;
        break;
      case 'exposure':
        moduleKey = exposureHashKey;
        break;
      case 'membership':
        moduleKey = membershipHashKey;
        break;
      default:
        throw new Error(`Unsupported hash type: ${hashType}`);
    }

    if (!moduleKey) {
      throw new Error(`Hash key for type ${hashType} is not defined`);
    }

    // Return the module-specific hash by hashing the SUUID with the module key.
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      suuid + moduleKey
    );
  }
}