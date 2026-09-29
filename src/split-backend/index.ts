import cors from 'cors';
import express from 'express';

import { addRoutes } from './routes.js';

if (!process.env.ENCRYPTION_KEY) {
  throw new Error(`ENCRYPTION_KEY env variable not set`);
}

if (!process.env.ONESIGNAL_KEY) {
  throw new Error(`ONESIGNAL_KEY env variable not set`);
}

const app = express.Router();

// cors middleware — all origins for now; no cookies, so no credentials
app.use(cors({ methods: 'POST' }));

addRoutes(app);

export default app;
