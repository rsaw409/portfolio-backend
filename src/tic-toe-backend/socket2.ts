import type { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import logger from '../@rsaw409/logger.js';

const MAX_PLAYERS_PER_GAME = 2;
const CLIENT_ORIGINS = {
  production: 'https://tictoe-rsaw409.onrender.com',
  development: 'http://localhost:3000',
};

type PlayersBySocketId = Record<string, string>;
type Games = Record<string, PlayersBySocketId>;

interface GameEventData {
  gameId: string;
  userName: string;
}

interface MoveData extends GameEventData {
  [key: string]: unknown;
}

interface RestartGameData extends GameEventData {
  [key: string]: unknown;
}

interface LeaveGameData extends GameEventData {
  userId?: string;
  [key: string]: unknown;
}

interface ClientToServerEvents {
  joinGame: (data: GameEventData) => void;
  madeMove: (data: MoveData) => void;
  RestartGame: (data: RestartGameData) => void;
  LeftGame: (data: LeaveGameData) => void;
}

interface ServerToClientEvents {
  users: (users: PlayersBySocketId) => void;
  receivedFromServer: (data: MoveData) => void;
  userRestartedGame: (data: RestartGameData) => void;
  userLeftGame: (data: LeaveGameData) => void;
  userDisconnected: (userName: string | undefined) => void;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

const getClientOrigin = (): string =>
  process.env.NODE_ENV === 'production'
    ? CLIENT_ORIGINS.production
    : CLIENT_ORIGINS.development;

/** Adds Socket.IO support for two-player tic-tac-toe games. */
const addSocket = (httpServer: HttpServer, path: string): void => {
  // Keep this as a plain object because the `users` event sends it to clients.
  const games: Games = Object.create(null);
  const io = createSocketServer(httpServer, path);

  const addPlayer = (gameId: string, socketId: string, userName: string): void => {
    games[gameId] ??= Object.create(null);
    games[gameId][socketId] = userName;
  };

  const removePlayer = (
    gameId: string,
    socketId: string
  ): string | undefined => {
    const players = games[gameId];
    if (!players) return undefined;

    const userName = players[socketId];
    delete players[socketId];

    if (Object.keys(players).length === 0) delete games[gameId];

    return userName;
  };

  const getPlayerCount = (gameId: string): number =>
    io.sockets.adapter.rooms.get(gameId)?.size ?? 0;

  io.on('connection', (socket: GameSocket) => {
    socket.on('joinGame', ({ gameId, userName }) => {
      if (getPlayerCount(gameId) >= MAX_PLAYERS_PER_GAME) return;

      socket.join(gameId);
      addPlayer(gameId, socket.id, userName);
      logger.info(`${userName} - ${socket.id} has joined game with id ${gameId}`);

      if (getPlayerCount(gameId) === MAX_PLAYERS_PER_GAME) {
        io.in(gameId).emit('users', games[gameId]);
      }
    });

    socket.on('madeMove', (data) => {
      logger.info(`${data.userName} has made his move.`);
      socket.to(data.gameId).emit('receivedFromServer', data);
    });

    socket.on('RestartGame', (data) => {
      socket.to(data.gameId).emit('userRestartedGame', data);
    });

    socket.on('LeftGame', (data) => {
      socket.leave(data.gameId);
      removePlayer(data.gameId, socket.id);
      socket.to(data.gameId).emit('userLeftGame', data);
    });

    socket.on('disconnecting', () => {
      for (const gameId of socket.rooms) {
        if (gameId === socket.id) continue;

        const userName = removePlayer(gameId, socket.id);
        socket.to(gameId).emit('userDisconnected', userName);
      }
    });
  });
};

const createSocketServer = (httpServer: HttpServer, path: string): GameServer =>
  new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path,
    cors: {
      origin: getClientOrigin(),
      methods: ['GET', 'POST'],
    },
  });

export { addSocket };
