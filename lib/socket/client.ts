import { io, Socket } from 'socket.io-client';
import {
  EVENT_TRANSLATION_PIPELINE_STATUS,
  EVENT_TRANSLATION_PREFERENCE,
  EVENT_TRANSLATION_TRACK_READY,
  SFU_GET_ROUTER_RTP_CAPABILITIES,
  SFU_CREATE_TRANSPORT,
  SFU_CONNECT_TRANSPORT,
  SFU_PRODUCE,
  SFU_CLOSE_PRODUCER,
  SFU_CONSUME,
  SFU_RESUME_CONSUMER,
  SFU_NEW_PRODUCER,
  SFU_PRODUCER_CLOSED,
} from './events';

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
    if (this.socket || this.connectionPromise) {
      await this.disconnect();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
        auth: { token },
        withCredentials: true,
        forceNew: true,
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

  async joinRoom(roomId: string): Promise<{ userId: string; email: string }[]> {
    if (!this.socket) throw new Error('Socket not connected');
    return new Promise((resolve, reject) => {
      this.socket!.emit('join-room', roomId);

      const timeout = setTimeout(() => reject(new Error('Join room timeout')), 5000);

      const handleError = (error: any) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.socket!.once('room-participants', (participants: { userId: string; email: string }[]) => {
        clearTimeout(timeout);
        resolve(participants);
      });

      this.socket!.once('error', handleError);
    });
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');
    this.socket.emit('leave-room', roomId);
  }

  async sendMediaState(mediaState: { video: boolean; audio: boolean }): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');
    this.socket.emit('media-state-change', mediaState);
  }

  async sendTranslationPreference(data: { language: string | null }): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');
    this.socket.emit(EVENT_TRANSLATION_PREFERENCE, data);
  }

  // --- SFU methods ---

  private sfuAck<T>(event: string, payload: object): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Socket not connected'));
      const timeout = setTimeout(() => reject(new Error(`${event} timeout`)), 10000);
      this.socket.emit(event, payload, (result: any) => {
        clearTimeout(timeout);
        if (result?.error) reject(new Error(result.error));
        else resolve(result as T);
      });
    });
  }

  getSfuRouterRtpCapabilities(roomId: string): Promise<any> {
    return this.sfuAck(SFU_GET_ROUTER_RTP_CAPABILITIES, { roomId });
  }

  createSfuTransport(roomId: string, direction: 'send' | 'recv'): Promise<any> {
    return this.sfuAck(SFU_CREATE_TRANSPORT, { roomId, direction });
  }

  connectSfuTransport(transportId: string, dtlsParameters: any): Promise<void> {
    return this.sfuAck(SFU_CONNECT_TRANSPORT, { transportId, dtlsParameters });
  }

  sfuProduce(roomId: string, transportId: string, kind: string, rtpParameters: any): Promise<{ producerId: string }> {
    return this.sfuAck(SFU_PRODUCE, { roomId, transportId, kind, rtpParameters });
  }

  sfuConsume(roomId: string, producerId: string, rtpCapabilities: any): Promise<any> {
    return this.sfuAck(SFU_CONSUME, { roomId, producerId, rtpCapabilities });
  }

  sfuCloseProducer(roomId: string, kind: string): Promise<void> {
    return this.sfuAck(SFU_CLOSE_PRODUCER, { roomId, kind });
  }

  sfuResumeConsumer(consumerId: string): Promise<void> {
    return this.sfuAck(SFU_RESUME_CONSUMER, { consumerId });
  }

  onSfuNewProducer(
    callback: (data: { producerId: string; userId: string; kind: string }) => void
  ) {
    this.socket?.on(SFU_NEW_PRODUCER, callback);
    return () => this.socket?.off(SFU_NEW_PRODUCER, callback);
  }

  onSfuProducerClosed(
    callback: (data: { producerId: string; userId: string }) => void
  ) {
    this.socket?.on(SFU_PRODUCER_CLOSED, callback);
    return () => this.socket?.off(SFU_PRODUCER_CLOSED, callback);
  }

  // --- Translation events ---

  onTranslationTrackReady(
    callback: (data: { speakerId: string; language: string; trackId: string }) => void
  ) {
    this.socket?.on(EVENT_TRANSLATION_TRACK_READY, callback);
    return () => this.socket?.off(EVENT_TRANSLATION_TRACK_READY, callback);
  }

  onTranslationPipelineStatus(
    callback: (data: { speakerId: string; language: string; state: string }) => void
  ) {
    this.socket?.on(EVENT_TRANSLATION_PIPELINE_STATUS, callback);
    return () => this.socket?.off(EVENT_TRANSLATION_PIPELINE_STATUS, callback);
  }

  // --- Room presence events ---

  onParticipantJoined(callback: (data: { userId: string; email: string }) => void) {
    this.socket?.on('participant-joined', callback);
    return () => this.socket?.off('participant-joined', callback);
  }

  onParticipantLeft(callback: (data: { userId: string }) => void) {
    this.socket?.on('participant-left', callback);
    return () => this.socket?.off('participant-left', callback);
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
