import { fileTypeFromBuffer } from 'file-type';
import logger from '../../@rsaw409/logger.js';
import { Request, Response, NextFunction } from 'express';

const whitelist = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const fileValidation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      logger.info('No file found.');
      return next();
    }
    const meta = await fileTypeFromBuffer(req.file.buffer);

    if (!meta) {
      throw new Error('Could not find file type');
    }

    if (!whitelist.includes(meta.mime)) {
      throw new Error('This is not valid image file.');
    } else {
      return next();
    }
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).send({ message: error.message });
    }
    return res.status(500).send({
      message: 'Unknown error',
    });
  }
};

export { fileValidation, whitelist };
