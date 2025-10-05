import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import logger from '../src/@rsaw409/logger.js';
import bodyParser from 'body-parser';
import { rateLimit } from 'express-rate-limit';
import { createServer, Server } from 'http';
import portfolioMain from './portfolio-backend/index.js';
import ticToeMain from './tic-toe-backend/index.js';
import splitMain from './split-backend/index.js';

import DB from './postgres.js';
import cookieParser from 'cookie-parser';
import { Socket } from 'net';

const PORT = process.env.PORT ?? 3000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.includes('health');
  },
});

const main = async () => {
  await DB.init();

  const app: Application = express();
  const http: Server = createServer(app);

  app.set('trust proxy', 1);

  app.use(logger.requestLogger);

  app.use(cookieParser());

  app.use(bodyParser.json());

  app.use('/portfolio', limiter, portfolioMain);

  app.use('/split', limiter, splitMain);

  await ticToeMain(http);

  app.use('/health', (req: Request, res: Response) => {
    res.status(200).send({ message: 'Server is Running.' });
  });

  app.use('/db_health', async (req: Request, res: Response) => {
    await DB.getSequelize().authenticate();
    return res.status(200).send({ message: 'DB is Running.' });
  });

  logger.info('Server is Ready.');

  http.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE') {
      logger.error('Address in use, retrying...');
      setTimeout(() => {
        http.close();
        http.listen(PORT);
      }, 1000);
    }
  });

  // Set a global timeout for all requests (e.g., 10s)

  http.setTimeout(10 * 1000, ((socket: Socket) => {
    console.log('⏱️ Request timed out!');
    socket.end('HTTP/1.1 408 Request Timeout\r\n\r\n');
  }) as unknown as () => void);

  http.listen(PORT);
};

main();
