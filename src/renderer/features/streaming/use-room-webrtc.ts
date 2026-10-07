import { useEffect, useRef, useState } from 'react';
import type {
  RoomSnapshot,
  WebRtcDescriptionMessage,
  WebRtcIceCandidateMessage,
  WebRtcSignalResult,
} from '../../../shared/types/signaling';
import type { SignalingClient } from '../../lib/signaling-client';

export type PeerConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

const PEER_CONNECTION_TIMEOUT_MS = 8_000;
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function relayWithAcknowledgment(
  emit: (acknowledge: (result: WebRtcSignalResult) => void) => void,
): Promise<WebRtcSignalResult> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(
      () => resolve({ ok: false, error: 'INVALID_SIGNAL' }),
      PEER_CONNECTION_TIMEOUT_MS,
    );

    emit((result) => {
      window.clearTimeout(timeout);
      resolve(result);
    });
  });
}

export function useRoomWebRtc(
  socket: SignalingClient,
  room: RoomSnapshot | null,
  localStream: MediaStream | null,
) {
  const [connectionStates, setConnectionStates] = useState<Record<string, PeerConnectionStatus>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const videoSendersRef = useRef(new Map<string, RTCRtpSender>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const roomRef = useRef<RoomSnapshot | null>(room);
  roomRef.current = room;

  useEffect(() => {
    let disposed = false;

    const updateStatus = (peerId: string, status: PeerConnectionStatus) => {
      if (!disposed) {
        setConnectionStates((current) => ({ ...current, [peerId]: status }));
      }
    };

    const sendCandidate = (peerId: string, candidate: RTCIceCandidate) => {
      void relayWithAcknowledgment((acknowledge) => {
        socket.emit(
          'webrtc:ice-candidate',
          {
            toParticipantId: peerId,
            candidate: {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex,
              usernameFragment: candidate.usernameFragment,
            },
          },
          acknowledge,
        );
      }).then((result) => {
        if (!result.ok) {
          updateStatus(peerId, 'failed');
        }
      });
    };

    const createPeerConnection = (peerId: string, isHost: boolean): RTCPeerConnection => {
      const connection = new RTCPeerConnection(RTC_CONFIGURATION);
      peerConnectionsRef.current.set(peerId, connection);
      updateStatus(peerId, 'connecting');

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          sendCandidate(peerId, event.candidate);
        }
      };

      connection.onconnectionstatechange = () => {
        const state = connection.connectionState;
        if (state === 'connected' || state === 'disconnected' || state === 'failed') {
          updateStatus(peerId, state);
        } else if (state === 'new' || state === 'connecting') {
          updateStatus(peerId, 'connecting');
        }
      };

      connection.oniceconnectionstatechange = () => {
        if (connection.iceConnectionState === 'failed') {
          updateStatus(peerId, 'failed');
        } else if (connection.iceConnectionState === 'disconnected') {
          updateStatus(peerId, 'disconnected');
        }
      };

      connection.ondatachannel = (event) => {
        event.channel.onopen = () => updateStatus(peerId, 'connected');
        event.channel.onclose = () => {
          updateStatus(peerId, 'disconnected');
        };
      };

      connection.ontrack = (event) => {
        const [stream] = event.streams;
        const receivedStream = stream ?? new MediaStream([event.track]);
        const updateRemoteStream = () => {
          setRemoteStreams((current) => ({
            ...current,
            [peerId]: receivedStream,
          }));
        };
        event.track.addEventListener('unmute', updateRemoteStream);
        event.track.addEventListener('mute', updateRemoteStream);
        updateRemoteStream();
      };

      if (isHost) {
        const controlChannel = connection.createDataChannel('topcast-control');
        controlChannel.onopen = () => updateStatus(peerId, 'connected');
        controlChannel.onclose = () => updateStatus(peerId, 'disconnected');
      }

      return connection;
    };

    const addPendingCandidates = async (peerId: string, connection: RTCPeerConnection) => {
      const candidates = pendingCandidatesRef.current.get(peerId) ?? [];
      pendingCandidatesRef.current.delete(peerId);
      for (const candidate of candidates) {
        await connection.addIceCandidate(candidate);
      }
    };

    const handleDescription = async (message: WebRtcDescriptionMessage) => {
      const currentRoom = roomRef.current;
      if (!currentRoom || disposed) {
        return;
      }

      const isHost = currentRoom.participants.some(
        (participant) => participant.id === socket.id && participant.role === 'host',
      );
      const remoteParticipant = currentRoom.participants.find(
        (participant) => participant.id === message.fromParticipantId,
      );

      try {
        if (message.description.type === 'offer' && !isHost) {
          let connection = peerConnectionsRef.current.get(message.fromParticipantId);
          if (!connection) {
            connection = createPeerConnection(message.fromParticipantId, false);
          }
          await connection.setRemoteDescription(message.description);
          await addPendingCandidates(message.fromParticipantId, connection);
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          const localDescription = connection.localDescription;
          if (!localDescription || localDescription.type !== 'answer' || !localDescription.sdp) {
            throw new Error('Could not create a WebRTC answer');
          }
          const result = await relayWithAcknowledgment((acknowledge) => {
            socket.emit(
              'webrtc:description',
              {
                toParticipantId: message.fromParticipantId,
                description: { type: 'answer', sdp: localDescription.sdp },
              },
              acknowledge,
            );
          });
          if (!result.ok) {
            throw new Error(`Signaling server rejected answer: ${result.error}`);
          }
          return;
        }

        if (message.description.type === 'answer' && isHost && remoteParticipant?.role === 'guest') {
          const connection = peerConnectionsRef.current.get(message.fromParticipantId);
          if (!connection || connection.signalingState !== 'have-local-offer') {
            return;
          }
          await connection.setRemoteDescription(message.description);
          await addPendingCandidates(message.fromParticipantId, connection);
        }
      } catch {
        updateStatus(message.fromParticipantId, 'failed');
      }
    };

    const handleIceCandidate = async (message: WebRtcIceCandidateMessage) => {
      const currentRoom = roomRef.current;
      const connection = peerConnectionsRef.current.get(message.fromParticipantId);
      if (!currentRoom || !connection || !connection.remoteDescription) {
        const queued = pendingCandidatesRef.current.get(message.fromParticipantId) ?? [];
        queued.push(message.candidate);
        pendingCandidatesRef.current.set(message.fromParticipantId, queued);
        return;
      }

      try {
        await connection.addIceCandidate(message.candidate);
      } catch {
        updateStatus(message.fromParticipantId, 'failed');
      }
    };

    socket.on('webrtc:description', handleDescription);
    socket.on('webrtc:ice-candidate', handleIceCandidate);

    return () => {
      disposed = true;
      socket.off('webrtc:description', handleDescription);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      for (const connection of peerConnectionsRef.current.values()) {
        connection.close();
      }
      peerConnectionsRef.current.clear();
      videoSendersRef.current.clear();
      pendingCandidatesRef.current.clear();
      setRemoteStreams({});
    };
  }, [socket]);

  useEffect(() => {
    if (!room) {
      for (const connection of peerConnectionsRef.current.values()) {
        connection.close();
      }
      peerConnectionsRef.current.clear();
      videoSendersRef.current.clear();
      pendingCandidatesRef.current.clear();
      setConnectionStates({});
      setRemoteStreams({});
      return;
    }

    const self = room.participants.find((participant) => participant.id === socket.id);
    if (!self) {
      return;
    }

    const participantsById = new Map(room.participants.map((participant) => [participant.id, participant]));
    for (const [peerId, connection] of peerConnectionsRef.current) {
      if (!participantsById.has(peerId)) {
        connection.close();
        peerConnectionsRef.current.delete(peerId);
        videoSendersRef.current.delete(peerId);
        pendingCandidatesRef.current.delete(peerId);
        setRemoteStreams((current) => {
          const next = { ...current };
          delete next[peerId];
          return next;
        });
        setConnectionStates((current) => {
          const next = { ...current };
          delete next[peerId];
          return next;
        });
      }
    }

    if (self.role !== 'host') {
      return;
    }

    for (const participant of room.participants) {
      if (participant.role !== 'guest' || peerConnectionsRef.current.has(participant.id)) {
        continue;
      }

      const connection = createHostConnection();
      peerConnectionsRef.current.set(participant.id, connection);
      const videoSender = connection.addTransceiver('video', { direction: 'sendonly' }).sender;
      videoSendersRef.current.set(participant.id, videoSender);
      void negotiateHostConnection(
        socket,
        participant.id,
        connection,
        videoSender,
        localStream?.getVideoTracks()[0] ?? null,
        (status) => {
          setConnectionStates((current) => ({ ...current, [participant.id]: status }));
        },
      );
    }
  }, [room, socket, localStream]);

  useEffect(() => {
    const videoTrack = localStream?.getVideoTracks()[0] ?? null;
    for (const [peerId, sender] of videoSendersRef.current) {
      void sender.replaceTrack(videoTrack).catch(() => {
        setConnectionStates((current) => ({ ...current, [peerId]: 'failed' }));
      });
    }
  }, [localStream]);

  return { connectionStates, remoteStreams };
}

function createHostConnection(): RTCPeerConnection {
  return new RTCPeerConnection(RTC_CONFIGURATION);
}

async function negotiateHostConnection(
  socket: SignalingClient,
  peerId: string,
  connection: RTCPeerConnection,
  videoSender: RTCRtpSender,
  videoTrack: MediaStreamTrack | null,
  updateStatus: (status: PeerConnectionStatus) => void,
): Promise<void> {
  connection.onicecandidate = (event) => {
    const candidate = event.candidate;
    if (!candidate) {
      return;
    }
    void relayWithAcknowledgment((acknowledge) => {
      socket.emit(
        'webrtc:ice-candidate',
        {
          toParticipantId: peerId,
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            usernameFragment: candidate.usernameFragment,
          },
        },
        acknowledge,
      );
    }).then((result) => {
      if (!result.ok) {
        updateStatus('failed');
      }
    });
  };

  connection.onconnectionstatechange = () => {
    const state = connection.connectionState;
    if (state === 'connected' || state === 'disconnected' || state === 'failed') {
      updateStatus(state);
    } else if (state === 'new' || state === 'connecting') {
      updateStatus('connecting');
    }
  };
  connection.oniceconnectionstatechange = () => {
    if (connection.iceConnectionState === 'failed') {
      updateStatus('failed');
    } else if (connection.iceConnectionState === 'disconnected') {
      updateStatus('disconnected');
    }
  };
  const controlChannel = connection.createDataChannel('topcast-control');
  controlChannel.onopen = () => updateStatus('connected');
  controlChannel.onclose = () => updateStatus('disconnected');

  try {
    await videoSender.replaceTrack(videoTrack);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    const localDescription = connection.localDescription;
    if (!localDescription || localDescription.type !== 'offer' || !localDescription.sdp) {
      throw new Error('Could not create a WebRTC offer');
    }

    const result = await relayWithAcknowledgment((acknowledge) => {
      socket.emit(
        'webrtc:description',
        {
          toParticipantId: peerId,
          description: { type: 'offer', sdp: localDescription.sdp },
        },
        acknowledge,
      );
    });
    if (!result.ok) {
      throw new Error(`Signaling server rejected offer: ${result.error}`);
    }
  } catch {
    updateStatus('failed');
  }
}
