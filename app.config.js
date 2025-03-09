// app.config.js
export default ({ config }) => {
  return {
    ...config,
    extra: {
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      standardHashKey: process.env.STANDARD_HASH_KEY,
      profileHashKey: process.env.PROFILE_HASH_KEY,
      testHashKey: process.env.TEST_HASH_KEY,
      healthHashKey: process.env.HEALTH_HASH_KEY,
      exposureHashKey: process.env.EXPOSURE_HASH_KEY,
      membershipHashKey: process.env.MEMBERSHIP_HASH_KEY
    },
  };
};

