import winston from 'winston';
import os from 'node:os';
import { nanoid } from 'nanoid';
import responseTime from 'response-time';
import { Request, Response } from 'express';

class Logger {
  readonly #logger: winston.Logger;

  constructor() {
    this.#logger = winston.createLogger({
      level: 'info',
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
            winston.format.colorize({ all: true }),
            winston.format.simple()
          ),
        }),
        // new winston.transports.File({
        //   filename: 'logs.log',
        //   format: winston.format.combine(
        //     winston.format.errors({ stack: true }),
        //     winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
        //     winston.format.json()
        //   ),
        // }),
      ],
      exitOnError: false,
      defaultMeta: {
        service: process.env.npm_package_name,
        systemUser: os.userInfo().username,
        userInfo: JSON.stringify(os.userInfo()),
        uniqueId: nanoid,
      },
    });
  }

  info(message: string) {
    this.#logger.info(message);
  }

  error(message: any) {
    this.#logger.error(message);
  }

  requestLogger = responseTime((req: Request, res: Response, time) => {
    let ignoreUrls = ['/health', '/db_health'];
    if (!ignoreUrls.includes(req.originalUrl)) {
      let msg = `${req.method} ${req.originalUrl} ${res.statusCode}`;
      if (time) msg += ` ${Math.round(time)}ms`;
      if (res.statusCode < 400) {
        this.info(msg);
      } else {
        this.error(msg);
      }
    }
  });
}

export default new Logger();
