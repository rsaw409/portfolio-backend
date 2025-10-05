import express from 'express';
import passport from 'passport';
import cookieSession from 'cookie-session';
import lusca from 'lusca';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';

import { addRoutes } from './routes.js';
import authRoute from './auth-routes.js';
import { addRoutes as addProtectedRouted } from './protected-routes.js';

const isProduction = process.env?.NODE_ENV === 'production';

/* Backend for https://portfolio-rsaw409.onrender.com/ */

if (!process.env.CLIENT_ADDRESS1) {
  throw new Error(`CLIENT_ADDRESS1 env variable not set`);
}

if (!process.env.CLIENT_ADDRESS2) {
  throw new Error(`CLIENT_ADDRESS2 env variable not set`);
}

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error(`GOOGLE_CLIENT_ID env variable not set`);
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(`GOOGLE_CLIENT_SECRET env variable not set`);
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(`GOOGLE_CLIENT_SECRET env variable not set`);
}

if (!process.env.ENCRYPTION_KEY) {
  throw new Error(`ENCRYPTION_KEY env variable not set`);
}

if (!process.env.SUPABASE_URL) {
  throw new Error(`SUPABASE_URL env variable not set`);
}

if (!process.env.SUPABASE_KEY) {
  throw new Error(`SUPABASE_KEY env variable not set`);
}

const app = express.Router();

// cors middleware
app.use(
  cors({
    origin: [process.env.CLIENT_ADDRESS1, process.env.CLIENT_ADDRESS2],
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
  })
);

// session middleware
app.use(
  cookieSession({
    name: 'session',
    secret: process.env['ENCRYPTION_KEY'],
    maxAge: 60 * 60 * 1000,
    httpOnly: true,
  })
);

// register regenerate & save after the cookieSession middleware initialization
app.use(function (request: Request, response: Response, next: NextFunction) {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb: () => void) => {
      cb();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb: () => void) => {
      cb();
    };
  }
  next();
});

// csrf protection middleware
app.use(
  lusca.csrf({
    cookie: {
      name: 'XSRF-TOKEN',
      options: {
        httpOnly: false,
        sameSite: 'None',
        secure: true,
        domain: isProduction ? 'portfolio.rsaw409.me' : 'localhost',
      },
    },
    angular: true,
    secret: process.env['ENCRYPTION_KEY'],
  })
);

app.use(passport.initialize());

app.use(passport.session());

// GET APIS
addRoutes(app);

app.use(authRoute);

// POST APIS
addProtectedRouted(app);

export default app;
