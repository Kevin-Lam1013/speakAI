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
  private remoteStreams: Map<string, MediaStream> = new Map();

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
    console.log('[PCM] setLocalStream:start', {
      hasStream: Boolean(stream),
      audioTracks: stream?.getAudioTracks().length || 0,
      videoTracks: stream?.getVideoTracks().length || 0,
    });
    // Stop old tracks if they exist
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    this.localStream = stream;

    // Update all peer connections with the new stream using replaceTrack
    for (const [userId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();

      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        console.log('[PCM] updating senders for user', userId, {
          hasAudioTrack: Boolean(audioTrack),
          hasVideoTrack: Boolean(videoTrack),
          senderKinds: senders.map(s => s.track?.kind),
        });

        // Replace or add video track
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          try {
            await videoSender.replaceTrack(videoTrack);
            console.log('[PCM] video replaceTrack OK', userId);
          } catch (e) {
            console.warn('Failed to replace video track, removing and adding:', e);
            pc.removeTrack(videoSender);
            pc.addTrack(videoTrack, stream);
            console.log('[PCM] video remove+add', userId);
          }
        } else if (videoTrack && !videoSender) {
          pc.addTrack(videoTrack, stream);
          // Need to renegotiate when adding new tracks
          this.triggerRenegotiation(userId);
          console.log('[PCM] video addTrack + renegotiate', userId);
        } else if (videoSender && !videoTrack) {
          pc.removeTrack(videoSender);
          // Trigger renegotiation when removing tracks too
          this.triggerRenegotiation(userId);
          console.log('[PCM] video removeTrack + renegotiate', userId);
        }

        // Replace or add audio track
        const audioSender = senders.find(s => s.track?.kind === 'audio');
        if (audioSender && audioTrack) {
          try {
            await audioSender.replaceTrack(audioTrack);
            console.log('[PCM] audio replaceTrack OK', userId);
          } catch (e) {
            console.warn('Failed to replace audio track, removing and adding:', e);
            pc.removeTrack(audioSender);
            pc.addTrack(audioTrack, stream);
            console.log('[PCM] audio remove+add', userId);
          }
        } else if (audioTrack && !audioSender) {
          pc.addTrack(audioTrack, stream);
          // Need to renegotiate when adding new tracks
          this.triggerRenegotiation(userId);
          console.log('[PCM] audio addTrack + renegotiate', userId);
        } else if (audioSender && !audioTrack) {
          pc.removeTrack(audioSender);
          // Trigger renegotiation when removing tracks too
          this.triggerRenegotiation(userId);
          console.log('[PCM] audio removeTrack + renegotiate', userId);
        }
      } else {
        // Remove all tracks if no stream
        senders.forEach(sender => {
          if (sender.track) {
            pc.removeTrack(sender);
          }
        });
        // Trigger renegotiation when removing all tracks
        this.triggerRenegotiation(userId);
        console.log('[PCM] removed all tracks + renegotiate', userId);
      }
    }

    // Update media state
    if (stream) {
      this.mediaState = {
        video: stream.getVideoTracks().length > 0,
        audio: stream.getAudioTracks().length > 0,
      };
    } else {
      this.mediaState = { video: false, audio: false };
    }
    console.log('[PCM] setLocalStream:end mediaState', this.mediaState);
  }

  private triggerRenegotiation(userId: string) {
    // Use setTimeout to avoid doing this immediately during the track update
    setTimeout(async () => {
      const pc = this.peerConnections.get(userId);
      if (pc && pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (this.onRenegotiationNeeded) {
            this.onRenegotiationNeeded(userId, offer);
          }
          console.log('[PCM] triggerRenegotiation -> offer sent', userId);
        } catch (error) {
          console.error('Failed to renegotiate after adding track:', error);
        }
      }
    }, 100);
  }

  async toggleVideo(): Promise<boolean> {
    try {
      if (this.mediaState.video) {
        // Turn off video
        this.localStream?.getVideoTracks().forEach(track => track.stop());
        const hasAudio = this.mediaState.audio;
        if (hasAudio) {
          // Get fresh audio stream to avoid reference issues
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          await this.setLocalStream(audioStream);
        } else {
          await this.setLocalStream(null);
        }
        console.log('[PCM] toggleVideo:off');
        return false;
      } else {
        // Turn on video
        const hasAudio = this.mediaState.audio;
        const constraints: MediaStreamConstraints = { video: true };
        if (hasAudio) {
          constraints.audio = true;
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        await this.setLocalStream(newStream);
        console.log('[PCM] toggleVideo:on');
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
        const hasVideo = this.mediaState.video;
        if (hasVideo) {
          // Get fresh video stream to avoid reference issues
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          await this.setLocalStream(videoStream);
        } else {
          await this.setLocalStream(null);
        }
        console.log('[PCM] toggleAudio:off');
        return false;
      } else {
        // Turn on audio
        const hasVideo = this.mediaState.video;
        const constraints: MediaStreamConstraints = { audio: true };
        if (hasVideo) {
          constraints.video = true;
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        await this.setLocalStream(newStream);
        console.log('[PCM] toggleAudio:on');
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
      console.log('[PCM] createOffer: adding local tracks to PC', targetUserId, {
        audio: this.localStream.getAudioTracks().length,
        video: this.localStream.getVideoTracks().length,
      });
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
        // Check what tracks the offer contains
        const offer = new RTCSessionDescription(payload);
        const hasVideoInOffer = offer.sdp?.includes('m=video') && !offer.sdp?.includes('m=video 0');
        const hasAudioInOffer = offer.sdp?.includes('m=audio') && !offer.sdp?.includes('m=audio 0');
        console.log('[PCM] handle offer from', fromUserId, { hasAudioInOffer, hasVideoInOffer });

        await peerConnection.setRemoteDescription(offer);

        // No special fallback: tracks will be merged on ontrack

        // Add local stream to the answer if available
        if (this.localStream) {
          console.log('[PCM] handle offer: ensure local tracks present for answer', fromUserId, {
            audio: this.localStream.getAudioTracks().length,
            video: this.localStream.getVideoTracks().length,
          });
          this.localStream.getTracks().forEach(track => {
            const sender = peerConnection.getSenders().find(s => s.track?.kind === track.kind);
            if (!sender) {
              peerConnection.addTrack(track, this.localStream!);
            }
          });
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('[PCM] sending answer to', fromUserId);
        return {
          type: 'answer',
          payload: answer,
          targetUserId: fromUserId,
        };

      case 'answer':
        console.log('[PCM] handle answer from', fromUserId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
        break;

      case 'ice-candidate':
        if (payload) {
          console.log('[PCM] addIceCandidate from', fromUserId);
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

    // Handle incoming tracks; merge into a single MediaStream per user
    peerConnection.ontrack = event => {
      console.log('[PCM] ontrack', userId, {
        numStreams: event.streams.length,
        trackKind: event.track.kind,
        readyState: event.track.readyState,
        muted: event.track.muted,
      });
      const existing = this.remoteStreams.get(userId) || new MediaStream();
      // Add track to the aggregated stream if not already present
      const alreadyHas = existing.getTracks().some(t => t.id === event.track.id);
      if (!alreadyHas) {
        existing.addTrack(event.track);
      }
      this.remoteStreams.set(userId, existing);
      this.onStreamCallback(userId, existing);

      // Listen for track ended events
      event.track.addEventListener('ended', () => {
        console.log('[PCM] track ended', userId, event.track.kind);
        const agg = this.remoteStreams.get(userId);
        if (agg) {
          agg.getTracks().forEach(t => {
            if (t.id === event.track.id) agg.removeTrack(t);
          });
          if (agg.getTracks().length === 0) {
            this.remoteStreams.delete(userId);
            this.onStreamRemoveCallback(userId);
          } else {
            this.onStreamCallback(userId, agg);
          }
        }
      });

      // Also listen for track mute/unmute
      event.track.addEventListener('mute', () => {
        console.log('[PCM] track mute', userId, event.track.kind);
        const agg = this.remoteStreams.get(userId);
        if (agg) this.onStreamCallback(userId, agg);
      });

      event.track.addEventListener('unmute', () => {
        console.log('[PCM] track unmute', userId, event.track.kind);
        const agg = this.remoteStreams.get(userId);
        if (agg) this.onStreamCallback(userId, agg);
      });
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('[PCM] connectionState', userId, peerConnection.connectionState);
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
      this.remoteStreams.delete(userId);
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

  // Callback set by room component to handle renegotiation
  onRenegotiationNeeded?: (userId: string, offer: RTCSessionDescriptionInit) => void;
}
