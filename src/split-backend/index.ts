import express from 'express';

import { addRoutes } from './routes.js';

if (!process.env.ENCRYPTION_KEY) {
  throw new Error(`ENCRYPTION_KEY env variable not set`);
}

if (!process.env.ONESIGNAL_KEY) {
  throw new Error(`ONESIGNAL_KEY env variable not set`);
}

const app = express.Router();

addRoutes(app);

export default app;
