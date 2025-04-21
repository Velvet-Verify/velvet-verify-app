/* eslint-disable max-len, no-irregular-whitespace, require-jsdoc, @typescript-eslint/no-explicit-any */
// functions/src/health/getUserHealthStatuses.ts
import {
  onCall,
  type CallableRequest,
  HttpsError,
  type CallableOptions,
} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {computeHash} from "../computeHashedId";

/* ------------------------------------------------------------------ */
/* Request payload                                                    */
/* ------------------------------------------------------------------ */
interface GetUserHealthStatusesData {
  /** Which user’s SUUID to fetch. If omitted we return caller’s data. */
  suuid?: string;
  /** If true we return masked date ranges instead of real dates.      */
  hideDate?: boolean;
}

/* ------------------------------------------------------------------ */
/* Firestore schema (condensed v2)                                    */
/* ------------------------------------------------------------------ */
interface FirestoreHealthData {
  /** 0 = Not Tested, 1 = Negative, 2 = Exposed, 3 = Positive          */
  healthStatus?: number;
  /** Firestore Timestamp | JS Date                                   */
  statusDate?: admin.firestore.Timestamp | Date;
  /** accommodate any future / unknown fields                         */
  [key: string]: unknown;
}

/**
 * Shape returned to the front‑end.
 * `statusDate` is formatted (ISO YYYY‑MM‑DD) or masked / null.
 */
interface TransformedHealthData
  extends Omit<FirestoreHealthData, "statusDate"> {
  statusDate?: string | null;
}

/* ------------------------------------------------------------------ */
/* Callable options                                                   */
/* ------------------------------------------------------------------ */
const callableOptions: CallableOptions = {
  cors: "*",
  secrets: ["STANDARD_HASH_KEY", "HEALTH_HASH_KEY"],
};

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ------------------------------------------------------------------ */
/* Main callable                                                      */
/* ------------------------------------------------------------------ */
export const getUserHealthStatuses = onCall(
  callableOptions,
  async (request: CallableRequest<GetUserHealthStatusesData>) => {
    /* ---------- auth ---------- */
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be called while authenticated.");
    }

    /* ---------- inputs ---------- */
    const {suuid, hideDate = false} = request.data;
    const callerUID = request.auth.uid;

    /* ---------- hashes ---------- */
    const remoteSUUID = suuid ?? (await computeHash("standard", callerUID));
    const hsUUID = await computeHash("health", "", remoteSUUID);

    /* ---------- query ---------- */
    const prefix = `${hsUUID}_`;
    const snap = await db
      .collection("healthStatus")
      .where(admin.firestore.FieldPath.documentId(), ">=", prefix)
      .where(admin.firestore.FieldPath.documentId(), "<=", `${prefix}\uf8ff`)
      .get();

    const statuses: Record<string, TransformedHealthData> = {};

    snap.forEach((docSnap) => {
      // id format: HUUID_stdiId
      const [, stdiId] = docSnap.id.split("_");
      const rawData = docSnap.data() as FirestoreHealthData;

      /* ----- date handling ----- */
      let finalDate: string | null = null;
      const dateField = rawData.statusDate;
      if (dateField) {
        const jsDate =
          dateField instanceof admin.firestore.Timestamp ?
            dateField.toDate() :
            dateField;

        if (hideDate && jsDate instanceof Date) {
          finalDate = maskDate(jsDate);
        } else if (jsDate instanceof Date) {
          finalDate = jsDate.toISOString().slice(0, 10);
        }
      }

      statuses[stdiId] = {
        ...rawData,
        statusDate: finalDate,
      };
    });

    return {hsUUID, statuses};
  },
);

/* ------------------------------------------------------------------ */
/* Helper: mask real date → range bucket                              */
/* ------------------------------------------------------------------ */
function maskDate(d: Date): string {
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000); // ms → days
  if (diffDays <= 90) return "Last 90 Days";
  if (diffDays <= 180) return "Last 180 Days";
  if (diffDays <= 365) return "Last Year";
  return "Over 1 Year";
}
