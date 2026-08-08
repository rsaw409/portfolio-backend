import { getUserIdFromEmail } from '../db/queries/user.js';
import { NextFunction, Request, Response } from 'express';
import { Profile } from 'passport-google-oauth20';

const checkAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.isAuthenticated()) {
    const user: Profile = req.user as Profile;
    if (!user.emails?.length) {
      return res
        .status(403)
        .send({ message: 'Could not identify you as authorized user.' });
    }
    const user_id_from_query: number = Number.parseInt(
      req.query.user_id as string
    );
    const userId = await getUserIdFromEmail(user.emails[0]?.value);

    // Authorization validation
    if (user.emails[0]?.verified && userId === user_id_from_query) {
      return next();
    } else {
      return res
        .status(403)
        .send({ message: 'you do not have permission to edit details.' });
    }
  }
  return res.status(403).send({ message: 'Authentication Failed.' });
};

export { checkAuthenticated };
