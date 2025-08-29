import { io, Socket } from 'socket.io-client';

type SignalingType = 'offer' | 'answer' | 'ice-candidate';

interface SignalingMessage {
  type: SignalingType;
  payload: any;
  fromUserId: string;
  targetUserId: string;
}

class SocketClient {
  private static instance: SocketClient;
  private socket: Socket | null = null;
  private connectionPromise: Promise<Socket> | null = null;

  private constructor() {}

  static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  async connect(token: string): Promise<Socket> {
    // If we have an existing connection or are connecting, disconnect first
    if (this.socket || this.connectionPromise) {
      await this.disconnect();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        auth: { token },
        withCredentials: true,
        forceNew: true, // Force a new connection
      });

      socket.on('connect', () => {
        console.log('Socket connected');
        this.socket = socket;
        resolve(socket);
      });

      socket.on('connect_error', error => {
        console.error('Socket connection error:', error);
        this.connectionPromise = null;
        reject(error);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        this.connectionPromise = null;
      });
    });

    return this.connectionPromise;
  }

  async disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionPromise = null;
    }
  }

  async joinRoom(roomId: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    return new Promise((resolve, reject) => {
      this.socket!.emit('join-room', roomId);

      const timeout = setTimeout(() => {
        reject(new Error('Join room timeout'));
      }, 5000);

      const handleError = (error: any) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.socket!.once('room-participants', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('error', handleError);
    });
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('leave-room', roomId);
  }

  async sendSignal(data: {
    type: SignalingType;
    payload: any;
    targetUserId: string;
  }): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('signal', data);
  }

  async sendMediaState(mediaState: { video: boolean; audio: boolean }): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('media-state-change', mediaState);
  }

  onParticipantJoined(callback: (data: { userId: string; email: string }) => void) {
    this.socket?.on('participant-joined', callback);
    return () => this.socket?.off('participant-joined', callback);
  }

  onParticipantLeft(callback: (data: { userId: string }) => void) {
    this.socket?.on('participant-left', callback);
    return () => this.socket?.off('participant-left', callback);
  }

  onSignal(callback: (data: SignalingMessage) => void) {
    this.socket?.on('signal', callback);
    return () => this.socket?.off('signal', callback);
  }

  onRoomParticipants(callback: (participants: { userId: string; email: string }[]) => void) {
    this.socket?.on('room-participants', callback);
    return () => this.socket?.off('room-participants', callback);
  }

  onMediaStateChange(
    callback: (data: { userId: string; mediaState: { video: boolean; audio: boolean } }) => void
  ) {
    this.socket?.on('media-state-change', callback);
    return () => this.socket?.off('media-state-change', callback);
  }
}

export const socketClient = SocketClient.getInstance();
