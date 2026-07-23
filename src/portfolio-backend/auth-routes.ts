import express, { NextFunction, Request, Response } from 'express';
import passport from 'passport';

const app = express.Router();

app.get('/login/success', (req: Request, res: Response) => {
  if (req.user) {
    res.status(200).json({
      success: true,
      message: 'successful',
      user: req.user,
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'failed',
      user: null,
    });
  }
});

app.get('/login/failed', (req: Request, res: Response) => {
  res.status(401).json({
    success: false,
    message: 'failure',
  });
});

app.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    if (req.headers.referer?.includes('onrender')) {
      res.redirect(process.env.CLIENT_ADDRESS1);
    } else {
      res.redirect(process.env.CLIENT_ADDRESS2);
    }
  });
});

app.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

app.get(
  '/google/callback',
  function (req: Request, res: Response, next: NextFunction) {
    passport.authenticate('google', {
      successRedirect: req.headers.referer?.includes('onrender')
        ? process.env.CLIENT_ADDRESS1
        : process.env.CLIENT_ADDRESS2,
      failureRedirect: '/login/failed',
    })(req, res, next);
  }
);

export default app;
