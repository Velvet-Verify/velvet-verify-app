// functions/src/params.ts
import {defineSecret} from "firebase-functions/params";

export const STANDARD_HASH_KEY = defineSecret("STANDARD_HASH_KEY");
export const PROFILE_HASH_KEY = defineSecret("PROFILE_HASH_KEY");
export const HEALTH_HASH_KEY = defineSecret("HEALTH_HASH_KEY");
export const TEST_HASH_KEY = defineSecret("TEST_HASH_KEY");
export const EXPOSURE_HASH_KEY = defineSecret("EXPOSURE_HASH_KEY");
export const MEMBERSHIP_HASH_KEY = defineSecret("MEMBERSHIP_HASH_KEY");
