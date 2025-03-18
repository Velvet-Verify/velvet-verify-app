// functions/src/health/getUserHealthStatuses.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";

/**
 * The request can include `suuid` and an optional `hideDate`.
 */
interface GetUserHealthStatusesData {
  /**
   * Which user’s SUUID to fetch. If omitted, user is fetching their own data.
   */
  suuid?: string;

  /**
   * If true, we return masked date ranges instead of the real date.
   */
  hideDate?: boolean;
}

/**
 * A Firestore document's health data,
 * which we transform into our final return shape.
 */
interface FirestoreHealthData {
  testDate?: admin.firestore.Timestamp | Date;
  testResult?: boolean;
  exposureStatus?: boolean;
  exposureDate?: admin.firestore.Timestamp | Date;
  [key: string]: unknown; // any additional fields
}

/**
 * The final shape we store in `statuses[stdiId]`.
 * We'll keep testDate as a string or null after transformation.
 */
interface TransformedHealthData extends Omit<FirestoreHealthData, "testDate"> {
  testDate?: string | null;
}

const callableOptions: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY", "HEALTH_HASH_KEY"],
};

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Return the remote user’s health statuses from `healthStatus` collection.
 * If `hideDate` is true, we replace actual test dates with a masked string
 * (Last 90 Days, Last 180 Days, Last Year, Over 1 Year).
 */
export const getUserHealthStatuses = onCall(
  callableOptions,
  async (request: CallableRequest<GetUserHealthStatusesData>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be called while authenticated."
      );
    }

    const {suuid, hideDate = false} = request.data;

    let remoteSUUID = suuid;
    if (!remoteSUUID) {
      remoteSUUID = await computeHash("standard", request.auth.uid);
    }

    const hsUUID = await computeHash("health", "", remoteSUUID);

    const prefix = `${hsUUID}_`;
    const snapshot = await db
      .collection("healthStatus")
      .where(admin.firestore.FieldPath.documentId(), ">=", prefix)
      .where(admin.firestore.FieldPath.documentId(), "<=", prefix + "\uf8ff")
      .get();

    const statuses: Record<string, TransformedHealthData> = {};

    snapshot.forEach((docSnap) => {
      // e.g. docSnap.id = "hsUUID_stdiId"
      const docIdParts = docSnap.id.split("_");
      const stdiId = docIdParts[1];

      const rawData = docSnap.data() as FirestoreHealthData;

      let finalTestDate: string | null = null;
      if (rawData.testDate) {
        // If stored as Firestore Timestamp, convert to JS Date
        const dateObj =
          rawData.testDate instanceof admin.firestore.Timestamp ?
            rawData.testDate.toDate() :
            rawData.testDate;

        if (hideDate && dateObj instanceof Date) {
          finalTestDate = maskTestDate(dateObj);
        } else if (dateObj instanceof Date) {
          finalTestDate = dateObj.toISOString().slice(0, 10);
        }
      }

      // Spread rawData directly, then overwrite testDate
      statuses[stdiId] = {
        ...rawData,
        testDate: finalTestDate,
      };
    });

    return {hsUUID, statuses};
  }
);

/**
 * Converts a real Date into one of the following 4 tiers:
 * - "Last 90 Days"
 * - "Last 180 Days"
 * - "Last Year"
 * - "Over 1 Year"
 *
 * @param {Date} dateObj - The date we want to convert into a range
 * @return {string} - A textual representation of how recent the date is
 */
function maskTestDate(dateObj: Date): string {
  const now = Date.now();
  const diffMs = now - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 90) {
    return "Last 90 Days";
  } else if (diffDays <= 180) {
    return "Last 180 Days";
  } else if (diffDays <= 365) {
    return "Last Year";
  }
  return "Over 1 Year";
}
