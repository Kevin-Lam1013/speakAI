import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import * as jose from 'jose';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;

// JWT verification function
async function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    throw new Error('Invalid access token');
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication failed - no token'));
      }

      const decoded = await verifyAccessToken(token);
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch (error) {
      next(new Error('Authentication failed - invalid token'));
    }
  });

  // Handle socket connections
  io.on('connection', socket => {
    console.log(`User connected: ${socket.data.userId}`);

    // Handle joining a room
    socket.on('join-room', async roomId => {
      try {
        // Join the Socket.IO room
        await socket.join(roomId);

        // Get all participants in the room
        const sockets = await io.in(roomId).fetchSockets();
        const participants = sockets.map(s => ({
          userId: s.data.userId,
          email: s.data.email,
        }));

        // Notify everyone in the room about the new participant
        io.to(roomId).emit('participant-joined', {
          userId: socket.data.userId,
          email: socket.data.email,
        });

        // Send the list of existing participants to the new participant
        socket.emit('room-participants', participants);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle WebRTC signaling
    socket.on('signal', data => {
      try {
        console.log('signal', {
          from: socket.data.userId,
          type: data?.type,
          targetUserId: data?.targetUserId,
        });
      } catch {}
      const { type, payload, targetUserId } = data;

      // Find sockets for the target user in the same rooms as the sender
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);

      rooms.forEach(roomId => {
        // Forward the signal to the specific user in the room
        socket.to(roomId).emit('signal', {
          type,
          payload,
          fromUserId: socket.data.userId,
          targetUserId,
        });
      });
    });

    // Relay media state changes to room
    socket.on('media-state-change', mediaState => {
      try {
        console.log('media-state-change from', socket.data.userId, mediaState);
      } catch {}
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      rooms.forEach(roomId => {
        socket.to(roomId).emit('media-state-change', {
          userId: socket.data.userId,
          mediaState,
        });
      });
    });

    // Handle leaving a room
    socket.on('leave-room', async roomId => {
      try {
        await socket.leave(roomId);
        io.to(roomId).emit('participant-left', {
          userId: socket.data.userId,
        });
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.userId}`);
      // Notify all rooms this user was in
      socket.rooms.forEach(roomId => {
        if (roomId !== socket.id) {
          io.to(roomId).emit('participant-left', {
            userId: socket.data.userId,
          });
        }
      });
    });
  });

  console.log('Socket.IO server initialized');

  httpServer
    .once('error', err => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
