// funcitons/src/testCors.ts
import express from "express";
import cors from "cors";
import * as functions from "firebase-functions";

const app = express();

// Allow all origins for testing
app.use(cors({origin: true}));

app.get("/", (req: express.Request, res: express.Response) => {
  res.send("Hello from onRequest with CORS enabled!");
});

export const testCors = functions.https.onRequest(app);
