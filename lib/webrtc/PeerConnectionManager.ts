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

    // Ensure audio tracks are enabled before setting
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = true;
      });
    }

    this.localStream = stream;

    // Update all peer connections with the new stream using replaceTrack
    for (const [userId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();

      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        // Replace or add video track
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender && videoTrack) {
          try {
            await videoSender.replaceTrack(videoTrack);
          } catch (e) {
            console.warn('Failed to replace video track, removing and adding:', e);
            pc.removeTrack(videoSender);
            pc.addTrack(videoTrack, stream);
          }
        } else if (videoTrack && !videoSender) {
          pc.addTrack(videoTrack, stream);
          // Need to renegotiate when adding new tracks
          this.triggerRenegotiation(userId);
        } else if (videoSender && !videoTrack) {
          pc.removeTrack(videoSender);
          // Trigger renegotiation when removing tracks too
          this.triggerRenegotiation(userId);
        }

        // Handle audio track
        const audioSender = senders.find(s => s.track?.kind === 'audio');

        if (audioTrack) {
          // Enable the track
          audioTrack.enabled = true;

          // Create a dedicated audio stream
          const audioOnlyStream = new MediaStream([audioTrack]);

          // Remove existing sender if any
          if (audioSender) {
            pc.removeTrack(audioSender);
          }

          // Add the track with the dedicated stream
          const newSender = pc.addTrack(audioTrack, audioOnlyStream);

          console.log('Audio track handling:', {
            hadPreviousSender: !!audioSender,
            newSenderCreated: !!newSender,
            trackState: {
              id: audioTrack.id,
              enabled: audioTrack.enabled,
              muted: audioTrack.muted,
              readyState: audioTrack.readyState,
            },
          });

          // Always trigger renegotiation for audio changes
          this.triggerRenegotiation(userId);
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
        return true;
      }
    } catch (error) {
      console.error('Error toggling video:', error);
      return this.mediaState.video;
    }
  }

  async toggleAudio(): Promise<boolean> {
    try {
      if (!this.localStream) {
        // If no stream exists, create one with audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await this.setLocalStream(stream);
        this.mediaState.audio = true;
        return true;
      }

      const audioTrack = this.localStream.getAudioTracks()[0];
      if (!audioTrack) {
        // No audio track, add one
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newAudioTrack = audioStream.getAudioTracks()[0];
        this.localStream.addTrack(newAudioTrack);

        // Update peer connections with the new track
        for (const [userId, pc] of this.peerConnections.entries()) {
          pc.addTrack(newAudioTrack, this.localStream);
          this.triggerRenegotiation(userId);
        }

        this.mediaState.audio = true;
        return true;
      }

      // Toggle existing track
      audioTrack.enabled = !audioTrack.enabled;
      this.mediaState.audio = audioTrack.enabled;

      // Notify peers about track state change
      for (const [userId, pc] of this.peerConnections.entries()) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.track!.enabled = audioTrack.enabled;
        }
      }

      return audioTrack.enabled;
    } catch (error) {
      console.error('Error toggling audio:', error);
      return this.mediaState.audio;
    }
  }

  async createOffer(targetUserId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.createPeerConnection(targetUserId);

    // Add local stream if available
    if (this.localStream) {
      const tracks = this.localStream.getTracks();
      const audioTracks = tracks.filter(t => t.kind === 'audio');
      const videoTracks = tracks.filter(t => t.kind === 'video');

      console.log('Preparing to add tracks:', {
        totalTracks: tracks.length,
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
      });

      // Handle audio tracks first
      if (audioTracks.length > 0) {
        const audioTrack = audioTracks[0]; // Take the first audio track
        audioTrack.enabled = true;

        // Create a dedicated stream for audio
        const audioStream = new MediaStream([audioTrack]);
        const sender = peerConnection.addTrack(audioTrack, audioStream);

        console.log('Audio track addition:', {
          trackId: audioTrack.id,
          senderCreated: !!sender,
          trackState: {
            enabled: audioTrack.enabled,
            muted: audioTrack.muted,
            readyState: audioTrack.readyState,
          },
        });

        // Verify the track was actually added
        const verifySender = peerConnection.getSenders().find(s => s.track?.id === audioTrack.id);
        if (!verifySender) {
          console.warn('Audio track not properly added - attempting fallback');
          // Try adding with the original stream as a fallback
          const fallbackSender = peerConnection.addTrack(audioTrack, this.localStream!);
          console.log('Fallback audio sender created:', !!fallbackSender);
        }
      }

      // Then add video tracks
      videoTracks.forEach(track => {
        const sender = peerConnection.addTrack(track, this.localStream!);
        console.log('Video track addition:', {
          trackId: track.id,
          senderCreated: !!sender,
        });
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

        await peerConnection.setRemoteDescription(offer);

        // If the offer has no video, trigger stream update
        if (!hasVideoInOffer) {
          // Force a stream update by creating a new stream with only audio (if any)
          setTimeout(() => {
            const receivers = peerConnection.getReceivers();
            const activeVideoReceivers = receivers.filter(
              r => r.track?.kind === 'video' && r.track?.readyState === 'live'
            );
            const activeAudioReceivers = receivers.filter(
              r => r.track?.kind === 'audio' && r.track?.readyState === 'live'
            );

            if (activeVideoReceivers.length === 0 && activeAudioReceivers.length > 0) {
              // Create new stream with only audio
              const audioOnlyStream = new MediaStream(activeAudioReceivers.map(r => r.track!));
              this.onStreamCallback(fromUserId, audioOnlyStream);
            } else if (activeVideoReceivers.length === 0 && activeAudioReceivers.length === 0) {
              // No tracks at all
              this.onStreamRemoveCallback(fromUserId);
            }
          }, 100);
        }

        // Add local stream to the answer if available
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => {
            const sender = peerConnection.getSenders().find(s => s.track?.kind === track.kind);
            if (!sender) {
              peerConnection.addTrack(track, this.localStream!);
            }
          });
        }

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
      // Handle received audio tracks
      if (event.track.kind === 'audio') {
        // Force enable the track
        event.track.enabled = true;

        // Create a new MediaStream with just this track
        const audioStream = new MediaStream([event.track]);

        // Log the state before callback

        // Immediately trigger callback with the audio stream
        if (event.streams.length === 0) {
          this.onStreamCallback(userId, audioStream);
        }
      }

      if (event.streams.length > 0) {
        const stream = event.streams[0];
        this.onStreamCallback(userId, stream);

        // Listen for track ended events
        event.track.addEventListener('ended', () => {
          // Check if stream still has active video tracks specifically
          const activeVideoTracks = stream.getVideoTracks().filter(t => t.readyState === 'live');
          const activeAudioTracks = stream.getAudioTracks().filter(t => t.readyState === 'live');

          if (activeVideoTracks.length === 0 && activeAudioTracks.length === 0) {
            this.onStreamRemoveCallback(userId);
          } else {
            // Stream still has some tracks, update it
            this.onStreamCallback(userId, stream);
          }
        });

        // Also listen for track mute/unmute
        event.track.addEventListener('mute', () => {
          this.onStreamCallback(userId, stream);
        });

        event.track.addEventListener('unmute', () => {
          this.onStreamCallback(userId, stream);
        });
      }
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

  // Callback set by room component to handle renegotiation
  onRenegotiationNeeded?: (userId: string, offer: RTCSessionDescriptionInit) => void;
}
