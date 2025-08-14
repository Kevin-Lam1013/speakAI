interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  fromUserId: string;
  targetUserId: string;
}

interface MediaState {
  video: boolean;
  audio: boolean;
}

export class PeerConnectionManager {
  private peerConnections: Map<string, RTCPeerConnection>;
  private localStream: MediaStream | null;
  private config: PeerConnectionConfig;
  private onStreamCallback: (userId: string, stream: MediaStream) => void;
  private onStreamRemoveCallback: (userId: string) => void;
  private mediaState: MediaState = { video: false, audio: false };

  constructor(
    config: PeerConnectionConfig,
    onStream: (userId: string, stream: MediaStream) => void,
    onStreamRemove: (userId: string) => void
  ) {
    this.peerConnections = new Map();
    this.localStream = null;
    this.config = config;
    this.onStreamCallback = onStream;
    this.onStreamRemoveCallback = onStreamRemove;
  }

  async setLocalStream(stream: MediaStream | null) {
    // Stop old tracks if they exist
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    this.localStream = stream;

    // Update all peer connections with the new stream
    if (stream) {
      this.peerConnections.forEach(pc => {
        // Remove old tracks
        const senders = pc.getSenders();
        senders.forEach(sender => {
          pc.removeTrack(sender);
        });

        // Add new tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

      // Update media state
      this.mediaState = {
        video: stream.getVideoTracks().length > 0,
        audio: stream.getAudioTracks().length > 0,
      };
    } else {
      this.mediaState = { video: false, audio: false };
    }
  }

  async toggleVideo(): Promise<boolean> {
    try {
      if (this.mediaState.video) {
        // Turn off video
        this.localStream?.getVideoTracks().forEach(track => track.stop());
        const audioTrack = this.localStream?.getAudioTracks()[0];
        if (audioTrack) {
          // Create new stream with only audio
          const newStream = new MediaStream([audioTrack]);
          await this.setLocalStream(newStream);
        } else {
          await this.setLocalStream(null);
        }
        return false;
      } else {
        // Turn on video
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (this.localStream) {
          // Add video to existing stream
          this.localStream.addTrack(videoTrack);
          await this.setLocalStream(this.localStream);
        } else {
          // Create new stream with video only
          await this.setLocalStream(videoStream);
        }
        return true;
      }
    } catch (error) {
      console.error('Error toggling video:', error);
      return this.mediaState.video;
    }
  }

  async toggleAudio(): Promise<boolean> {
    try {
      if (this.mediaState.audio) {
        // Turn off audio
        this.localStream?.getAudioTracks().forEach(track => track.stop());
        const videoTrack = this.localStream?.getVideoTracks()[0];
        if (videoTrack) {
          // Create new stream with only video
          const newStream = new MediaStream([videoTrack]);
          await this.setLocalStream(newStream);
        } else {
          await this.setLocalStream(null);
        }
        return false;
      } else {
        // Turn on audio
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        if (this.localStream) {
          // Add audio to existing stream
          this.localStream.addTrack(audioTrack);
          await this.setLocalStream(this.localStream);
        } else {
          // Create new stream with audio only
          await this.setLocalStream(audioStream);
        }
        return true;
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
      return this.mediaState.audio;
    }
  }

  async createOffer(targetUserId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.createPeerConnection(targetUserId);

    // Add local stream if available
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleSignalingMessage(message: SignalingMessage) {
    const { type, payload, fromUserId } = message;

    let peerConnection = this.peerConnections.get(fromUserId);
    if (!peerConnection) {
      peerConnection = this.createPeerConnection(fromUserId);
    }

    switch (type) {
      case 'offer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        return {
          type: 'answer',
          payload: answer,
          targetUserId: fromUserId,
        };

      case 'answer':
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
        break;

      case 'ice-candidate':
        if (payload) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(payload));
        }
        break;
    }
  }

  private createPeerConnection(userId: string): RTCPeerConnection {
    if (this.peerConnections.has(userId)) {
      this.closePeerConnection(userId);
    }

    const peerConnection = new RTCPeerConnection(this.config);

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        this.onIceCandidate?.(userId, event.candidate);
      }
    };

    // Handle incoming streams
    peerConnection.ontrack = event => {
      this.onStreamCallback(userId, event.streams[0]);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      if (
        peerConnection.connectionState === 'disconnected' ||
        peerConnection.connectionState === 'failed'
      ) {
        this.onStreamRemoveCallback(userId);
        this.closePeerConnection(userId);
      }
    };

    this.peerConnections.set(userId, peerConnection);
    return peerConnection;
  }

  private closePeerConnection(userId: string) {
    const peerConnection = this.peerConnections.get(userId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(userId);
      this.onStreamRemoveCallback(userId);
    }
  }

  closeAllConnections() {
    this.peerConnections.forEach((_, userId) => {
      this.closePeerConnection(userId);
    });
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.mediaState = { video: false, audio: false };
  }

  getMediaState(): MediaState {
    return { ...this.mediaState };
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Callback set by room component to handle sending ICE candidates
  onIceCandidate?: (userId: string, candidate: RTCIceCandidate) => void;
}
