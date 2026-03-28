import { Device, types as mediasoupTypes } from 'mediasoup-client';
type RtpCapabilities = mediasoupTypes.RtpCapabilities;
type Transport = mediasoupTypes.Transport;
type Producer = mediasoupTypes.Producer;
type Consumer = mediasoupTypes.Consumer;

interface TransportParams {
  transportId: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: any;
}

export interface ConsumerParams {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
}

export interface SFUCallbacks {
  connectTransport: (transportId: string, dtlsParameters: any) => Promise<void>;
  produce: (
    transportId: string,
    kind: string,
    rtpParameters: any
  ) => Promise<{ producerId: string }>;
  closeProducer: (kind: string) => Promise<void>;
  consume: (
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ) => Promise<ConsumerParams>;
  resumeConsumer: (consumerId: string) => Promise<void>;
}

interface MediaState {
  video: boolean;
  audio: boolean;
}

export class SFUConnectionManager {
  private device: Device;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map(); // 'audio'|'video' -> producer
  private consumers: Map<string, Consumer> = new Map(); // consumerId -> consumer
  private remoteStreams: Map<string, MediaStream> = new Map(); // userId -> stream
  private mediaState: MediaState = { video: false, audio: false };
  private callbacks: SFUCallbacks;

  onStream: (userId: string, stream: MediaStream) => void = () => {};
  onStreamRemoved: (userId: string) => void = () => {};

  constructor(callbacks: SFUCallbacks) {
    this.device = new Device();
    this.callbacks = callbacks;
  }

  async load(routerRtpCapabilities: RtpCapabilities) {
    if (!this.device.loaded) {
      await this.device.load({ routerRtpCapabilities });
    }
  }

  get rtpCapabilities(): RtpCapabilities {
    return this.device.rtpCapabilities;
  }

  get loaded(): boolean {
    return this.device.loaded;
  }

  async createSendTransport(params: TransportParams) {
    this.sendTransport = this.device.createSendTransport({
      id: params.transportId,
      iceParameters: params.iceParameters,
      iceCandidates: params.iceCandidates,
      dtlsParameters: params.dtlsParameters,
    });

    this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.callbacks
        .connectTransport(params.transportId, dtlsParameters)
        .then(callback)
        .catch(errback);
    });

    this.sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      this.callbacks
        .produce(params.transportId, kind, rtpParameters)
        .then(({ producerId }) => callback({ id: producerId }))
        .catch(errback);
    });
  }

  async createRecvTransport(params: TransportParams) {
    this.recvTransport = this.device.createRecvTransport({
      id: params.transportId,
      iceParameters: params.iceParameters,
      iceCandidates: params.iceCandidates,
      dtlsParameters: params.dtlsParameters,
    });

    this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.callbacks
        .connectTransport(params.transportId, dtlsParameters)
        .then(callback)
        .catch(errback);
    });
  }

  async produceAudio(track: MediaStreamTrack): Promise<Producer> {
    if (!this.sendTransport) throw new Error('Send transport not created');
    const producer = await this.sendTransport.produce({ track });
    this.producers.set('audio', producer);
    this.mediaState.audio = true;
    return producer;
  }

  async produceVideo(track: MediaStreamTrack): Promise<Producer> {
    if (!this.sendTransport) throw new Error('Send transport not created');
    const producer = await this.sendTransport.produce({ track });
    this.producers.set('video', producer);
    this.mediaState.video = true;
    return producer;
  }

  async consumeProducer(producerId: string, userId: string): Promise<Consumer> {
    if (!this.recvTransport) throw new Error('Recv transport not created');

    const params = await this.callbacks.consume(producerId, this.device.rtpCapabilities);
    const consumer = await this.recvTransport.consume({
      id: params.consumerId,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters,
    });

    this.consumers.set(params.consumerId, consumer);

    const existing = this.remoteStreams.get(userId) || new MediaStream();
    existing.addTrack(consumer.track);
    this.remoteStreams.set(userId, existing);
    this.onStream(userId, new MediaStream(existing.getTracks()));

    await this.callbacks.resumeConsumer(params.consumerId);

    consumer.on('transportclose', () => {
      this.consumers.delete(params.consumerId);
    });

    return consumer;
  }

  /**
   * Remove a consumer by the producer it was consuming (e.g. on sfu:producer-closed).
   */
  removeConsumerByProducerId(producerId: string, userId: string) {
    for (const [consumerId, consumer] of this.consumers) {
      if (consumer.producerId === producerId) {
        this._removeConsumerTrack(consumerId, consumer, userId);
        break;
      }
    }
  }

  private _removeConsumerTrack(consumerId: string, consumer: Consumer, userId: string) {
    try { consumer.close(); } catch {}
    this.consumers.delete(consumerId);

    const stream = this.remoteStreams.get(userId);
    if (stream) {
      stream.removeTrack(consumer.track);
      if (stream.getTracks().length === 0) {
        this.remoteStreams.delete(userId);
        this.onStreamRemoved(userId);
      } else {
        this.onStream(userId, new MediaStream(stream.getTracks()));
      }
    }
  }

  async toggleVideo(): Promise<boolean> {
    if (this.mediaState.video) {
      // Tell the server to close the server-side producer FIRST
      // This triggers producer.observer.on('close') → SFU_PRODUCER_CLOSED → other clients remove consumer
      await this.callbacks.closeProducer('video');
      const producer = this.producers.get('video');
      if (producer) {
        try { producer.track?.stop(); } catch {}
        try { producer.close(); } catch {}
        this.producers.delete('video');
      }
      this.mediaState.video = false;
      return false;
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await this.produceVideo(stream.getVideoTracks()[0]);
      return true;
    }
  }

  async toggleAudio(): Promise<boolean> {
    if (this.mediaState.audio) {
      await this.callbacks.closeProducer('audio');
      const producer = this.producers.get('audio');
      if (producer) {
        try { producer.track?.stop(); } catch {}
        try { producer.close(); } catch {}
        this.producers.delete('audio');
      }
      this.mediaState.audio = false;
      return false;
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await this.produceAudio(stream.getAudioTracks()[0]);
      return true;
    }
  }

  getLocalStream(): MediaStream | null {
    const tracks: MediaStreamTrack[] = [];
    const audio = this.producers.get('audio');
    const video = this.producers.get('video');
    if (audio?.track) tracks.push(audio.track);
    if (video?.track) tracks.push(video.track);
    return tracks.length > 0 ? new MediaStream(tracks) : null;
  }

  getMediaState(): MediaState {
    return { ...this.mediaState };
  }

  closeAllConnections() {
    for (const producer of this.producers.values()) {
      try { producer.track?.stop(); producer.close(); } catch {}
    }
    this.producers.clear();
    for (const consumer of this.consumers.values()) {
      try { consumer.close(); } catch {}
    }
    this.consumers.clear();
    try { this.sendTransport?.close(); } catch {}
    try { this.recvTransport?.close(); } catch {}
    this.sendTransport = null;
    this.recvTransport = null;
    this.remoteStreams.clear();
    this.mediaState = { video: false, audio: false };
  }
}
