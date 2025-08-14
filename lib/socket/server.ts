import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyAccessToken } from '@/lib/jwt';

interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  targetUserId: string;
}

export function initializeSocketServer(httpServer: HTTPServer) {
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
        return next(new Error('Authentication failed'));
      }

      const decoded = await verifyAccessToken(token);
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // Handle socket connections
  io.on('connection', socket => {
    console.log(`User connected: ${socket.data.userId}`);

    // Handle joining a room
    socket.on('join-room', async (roomId: string) => {
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
    socket.on('signal', (data: SignalingData) => {
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

    // Handle leaving a room
    socket.on('leave-room', async (roomId: string) => {
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

  return io;
}
