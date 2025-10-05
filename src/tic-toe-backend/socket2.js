import { Server } from 'socket.io';
import logger from '../@rsaw409/logger.js';

const addSocket = (http, prefix) => {
  const games = {};

  const io = new Server(http, {
    path: prefix,
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? 'https://tictoe-rsaw409.onrender.com'
          : 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', function (socket) {
    socket.on('joinGame', (data) => {
      const gameId = data.gameId;
      const userName = data.userName;
      const userId = socket.id;

      let users = io.sockets.adapter.rooms.get(gameId);
      if (!users || users?.size < 2) {
        socket.join(gameId);
        logger.info(
          `${userName} - ${userId} has joined game with id ${gameId}`
        );

        if (!Object.hasOwn(games, gameId)) games[gameId] = {};
        games[gameId][userId] = userName;
      }

      users = io.sockets.adapter.rooms.get(gameId);

      if (users?.size === 2) {
        io.sockets.in(gameId).emit('users', games[gameId]);
      }
    });

    socket.on('madeMove', (data) => {
      const gameId = data.gameId;
      const userName = data.userName;
      // const [i, j] = data.index;
      // const symbol = data.symbol;
      logger.info(`${userName} has made his move.`);
      socket.to(gameId).emit('receivedFromServer', data);
    });

    socket.on('RestartGame', (data) => {
      socket.to(data.gameId).emit('userRestartedGame', data);
    });

    socket.on('LeftGame', (data) => {
      socket.leave(data.gameId);

      try {
        delete games?.[data?.gameId]?.[data?.userId];
        if (Object.keys(games?.[data?.gameId] ?? {})?.length === 0) {
          delete games?.[data?.gameId];
        }
      } catch (error) {
        logger.error(error);
      }
      socket.to(data.gameId).emit('userLeftGame', data);
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          let userName = '';
          try {
            userName = games?.[room]?.[socket.id];
            delete games?.[room]?.[socket.id];
            if (Object.keys(games?.[room] ?? {}).length === 0) {
              delete games?.[room];
            }
          } catch (error) {
            logger.error(error);
          }

          socket.to(room).emit('userDisconnected', userName);
        }
      }
    });
  });
};

export { addSocket };
