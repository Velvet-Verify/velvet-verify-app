// app.config.js
export default ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        NSCameraUsageDescription:
          'This app needs access to your camera so you can take a profile photo.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to your photo library so you can choose a profile photo.',
        NSPhotoLibraryAddUsageDescription:
          'This app saves the photo you take to your library.',
      },
    },
    plugins: [
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Velvet Verify to access your photos so you can pick a profile picture.',
          cameraPermission:
            'Allow Velvet Verify to use the camera to take your profile picture.',
          savePhotosPermission:
            'Allow Velvet Verify to save the photo you just took.',
        },
      ],
    ],
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
      membershipHashKey: process.env.MEMBERSHIP_HASH_KEY,
      eas: {
        projectId: 'd5ec91cd-e627-4c28-926d-1891bd420c29',
      },
    },
  };
};
