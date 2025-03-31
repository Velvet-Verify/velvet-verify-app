// functions/src/health/submitTestResults.ts

import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";
import {
  STANDARD_HASH_KEY,
  HEALTH_HASH_KEY,
  MEMBERSHIP_HASH_KEY,
} from "../params";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/** The client sends STDI results with:
 *   - stdiId (string)
 *   - result (boolean) => true=positive, false=negative
 *   - testDate (ISO string)
 */
interface STDIResult {
  stdiId: string;
  result: boolean;
  testDate: string; // e.g. "2025-03-01T22:28:02.000Z"
}

interface SubmitTestResultsData {
  results: STDIResult[];
}

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: [STANDARD_HASH_KEY, HEALTH_HASH_KEY, MEMBERSHIP_HASH_KEY],
};

export const submitTestResults = onCall(
  callableOptions,
  async (request: CallableRequest<SubmitTestResultsData>) => {
    // 1) Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated.");
    }
    const {uid} = request.auth;
    const data = request.data;
    if (!data || !Array.isArray(data.results)) {
      throw new HttpsError(
        "invalid-argument",
        "Missing or invalid test results array."
      );
    }

    // 2) Compute the user's SUUID (standard) + HSUUID (health)
    const suuid = await computeHash("standard", uid);
    const hsuuid = await computeHash("health", "", suuid);

    const now = new Date();

    // We'll track new negative results to propagate to bonded partners
    const newlyNegative: { stdiId: string; testDate: Date }[] = [];

    // 3) For each STDI in the submission:
    for (const {stdiId, result, testDate} of data.results) {
      const parsedDate = new Date(testDate);

      // 3a) Create a new `testResults` doc for auditing
      await db.collection("testResults").add({
        STDI: stdiId,
        SUUID: suuid,
        result, // boolean => true=positive, false=negative
        testDate: parsedDate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3b) Upsert the user's `healthStatus` document
      const hsDocId = `${hsuuid}_${stdiId}`;
      const hsRef = db.collection("healthStatus").doc(hsDocId);
      const hsSnap = await hsRef.get();

      let existingDate: Date | null = null;
      if (hsSnap.exists) {
        const d = hsSnap.data()?.testDate;
        if (d instanceof admin.firestore.Timestamp) {
          existingDate = d.toDate();
        } else if (typeof d === "string") {
          existingDate = new Date(d);
        }
      }

      // If this submission is more recent, overwrite testResult + testDate
      if (!existingDate || parsedDate > existingDate) {
        await hsRef.set(
          {
            testResult: result,
            // Store a Firestore Timestamp,
            // so the console shows "Jan 11, 2025..." etc.
            testDate: admin.firestore.Timestamp.fromDate(parsedDate),
          },
          {merge: true}
        );
      }

      // 3c) If it's a new negative, record for later partner inheritance
      if (!result) {
        newlyNegative.push({stdiId, testDate: parsedDate});
      }
    }

    // 4) Bonded Partner "inherit negative" logic
    if (newlyNegative.length > 0) {
      // 4a) Find all relevant connections with level=4 (bonded)
      // and status=1 (active)
      const connectionsSnap = await db
        .collection("connections")
        .where("connectionLevel", "==", 4)
        .where("connectionStatus", "==", 1)
        .where("senderSUUID", "in", [suuid])
        .get();

      const moreConnectionsSnap = await db
        .collection("connections")
        .where("connectionLevel", "==", 4)
        .where("connectionStatus", "==", 1)
        .where("recipientSUUID", "==", suuid)
        .get();

      const allBondedDocs = [
        ...connectionsSnap.docs,
        ...moreConnectionsSnap.docs,
      ];

      for (const cDoc of allBondedDocs) {
        const cData = cDoc.data();
        // Identify the partner's SUUID
        const partnerSUUID =
          cData.senderSUUID === suuid ?
            cData.recipientSUUID :
            cData.senderSUUID;

        // 4b) Check if partner is premium
        const partnerMUUUID = await computeHash("membership", "", partnerSUUID);
        const membershipSnap = await db
          .collection("memberships")
          .doc(partnerMUUUID)
          .get();
        if (!membershipSnap.exists) {
          continue; // free user => skip
        }
        const memData = membershipSnap.data();
        const endDate = memData?.endDate ? new Date(memData.endDate) : null;
        if (!endDate || endDate < now) {
          // membership ended => skip
          continue;
        }

        // 4c) For each newly negative STDI, see if partner can inherit
        for (const {stdiId, testDate: userDate} of newlyNegative) {
          const partnerHSUUID = await computeHash("health", "", partnerSUUID);
          const partnerHsRef = db
            .collection("healthStatus")
            .doc(`${partnerHSUUID}_${stdiId}`);
          const partnerHsSnap = await partnerHsRef.get();

          let partnerIsPositive = false;
          let partnerTestDate: Date | null = null;

          if (partnerHsSnap.exists) {
            const phData = partnerHsSnap.data() as {
              testResult?: boolean;
              testDate?: string | admin.firestore.Timestamp;
            };

            if (phData?.testResult === true) {
              partnerIsPositive = true;
            }
            if (phData?.testDate instanceof admin.firestore.Timestamp) {
              partnerTestDate = phData.testDate.toDate();
            } else if (typeof phData?.testDate === "string") {
              partnerTestDate = new Date(phData.testDate);
            }
          }

          // If partner is positive or has a more recent negative, skip
          if (partnerIsPositive) continue;
          if (partnerTestDate && partnerTestDate >= userDate) continue;

          // 4d) Otherwise, set partner's testResult => false,
          // store new Timestamp
          await partnerHsRef.set(
            {
              testResult: false,
              testDate: admin.firestore.Timestamp.fromDate(userDate),
            },
            {merge: true}
          );
        }
      }
    }

    return {success: true};
  }
);
