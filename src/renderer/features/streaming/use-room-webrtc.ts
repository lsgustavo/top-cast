import { useEffect, useRef, useState } from 'react';
import type {
  IceServerConfiguration,
  RoomSnapshot,
  WebRtcDescriptionMessage,
  WebRtcIceCandidateMessage,
  WebRtcSignalResult,
} from '../../../shared/types/signaling';
import type { SignalingClient } from '../../lib/signaling-client';
import { requestIceServers } from '../../lib/ice-configuration';

export type PeerConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

const PEER_CONNECTION_TIMEOUT_MS = 8_000;

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
  microphoneStream: MediaStream | null,
) {
  const [connectionStates, setConnectionStates] = useState<Record<string, PeerConnectionStatus>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const videoSendersRef = useRef(new Map<string, RTCRtpSender>());
  const systemAudioSendersRef = useRef(new Map<string, RTCRtpSender>());
  const microphoneSendersRef = useRef(new Map<string, RTCRtpSender>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const pendingCandidatesRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const selfParticipantIdRef = useRef<string | null>(null);
  const roomRef = useRef<RoomSnapshot | null>(room);
  const iceServersRequestRef = useRef<{
    socketId: string;
    promise: Promise<IceServerConfiguration[]>;
  } | null>(null);
  roomRef.current = room;

  const getIceServers = () => {
    const socketId = socket.id;
    if (!socketId) {
      return Promise.reject(new Error('O signaling ainda não atribuiu uma sessão.'));
    }
    const cached = iceServersRequestRef.current;
    if (cached?.socketId === socketId) {
      return cached.promise;
    }

    const promise = requestIceServers(socket).catch((error: unknown) => {
      if (iceServersRequestRef.current?.promise === promise) {
        iceServersRequestRef.current = null;
      }
      throw error;
    });
    iceServersRequestRef.current = { socketId, promise };
    return promise;
  };

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

    const createPeerConnection = (
      peerId: string,
      isHost: boolean,
      iceServers: IceServerConfiguration[],
    ): RTCPeerConnection => {
      const connection = new RTCPeerConnection({ iceServers });
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
        let receivedStream = remoteStreamsRef.current.get(peerId);
        if (!receivedStream) {
          receivedStream = new MediaStream();
          remoteStreamsRef.current.set(peerId, receivedStream);
        }
        for (const stream of event.streams) {
          for (const track of stream.getTracks()) {
            if (!receivedStream.getTracks().some((currentTrack) => currentTrack.id === track.id)) {
              receivedStream.addTrack(track);
            }
          }
        }
        if (!receivedStream.getTracks().some((track) => track.id === event.track.id)) {
          receivedStream.addTrack(event.track);
        }
        const updateRemoteStream = () => {
          setRemoteStreams((current) => ({
            ...current,
            [peerId]: receivedStream,
          }));
        };
        event.track.addEventListener('ended', () => {
          receivedStream.removeTrack(event.track);
          updateRemoteStream();
        }, { once: true });
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
            const iceServers = await getIceServers();
            if (disposed) {
              return;
            }
            connection = createPeerConnection(message.fromParticipantId, false, iceServers);
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
      systemAudioSendersRef.current.clear();
      microphoneSendersRef.current.clear();
      pendingCandidatesRef.current.clear();
      remoteStreamsRef.current.clear();
      selfParticipantIdRef.current = null;
      setRemoteStreams({});
    };
  }, [socket]);

  useEffect(() => {
    let cancelled = false;
    if (!room) {
      for (const connection of peerConnectionsRef.current.values()) {
        connection.close();
      }
      peerConnectionsRef.current.clear();
      videoSendersRef.current.clear();
      systemAudioSendersRef.current.clear();
      microphoneSendersRef.current.clear();
      pendingCandidatesRef.current.clear();
      remoteStreamsRef.current.clear();
      setConnectionStates({});
      setRemoteStreams({});
      return () => {
        cancelled = true;
      };
    }

    const self = room.participants.find((participant) => participant.id === socket.id);
    if (!self) {
      return () => {
        cancelled = true;
      };
    }

    if (selfParticipantIdRef.current && selfParticipantIdRef.current !== self.id) {
      for (const connection of peerConnectionsRef.current.values()) {
        connection.close();
      }
      peerConnectionsRef.current.clear();
      videoSendersRef.current.clear();
      systemAudioSendersRef.current.clear();
      microphoneSendersRef.current.clear();
      pendingCandidatesRef.current.clear();
      remoteStreamsRef.current.clear();
      setConnectionStates({});
      setRemoteStreams({});
    }
    selfParticipantIdRef.current = self.id;

    const participantsById = new Map(room.participants.map((participant) => [participant.id, participant]));
    for (const [peerId, connection] of peerConnectionsRef.current) {
      if (!participantsById.has(peerId)) {
        connection.close();
        peerConnectionsRef.current.delete(peerId);
        videoSendersRef.current.delete(peerId);
        systemAudioSendersRef.current.delete(peerId);
        microphoneSendersRef.current.delete(peerId);
        pendingCandidatesRef.current.delete(peerId);
        remoteStreamsRef.current.delete(peerId);
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
      return () => {
        cancelled = true;
      };
    }

    const createHostConnections = async () => {
      const newGuests = room.participants.filter(
        (participant) => participant.role === 'guest' && !peerConnectionsRef.current.has(participant.id),
      );
      if (newGuests.length === 0) {
        return;
      }

      let iceServers: IceServerConfiguration[];
      try {
        iceServers = await getIceServers();
      } catch {
        if (!cancelled) {
          setConnectionStates((current) => ({
            ...current,
            ...Object.fromEntries(newGuests.map((participant) => [participant.id, 'failed' as const])),
          }));
        }
        return;
      }
      if (cancelled) {
        return;
      }

      for (const participant of newGuests) {
        if (peerConnectionsRef.current.has(participant.id)) {
          continue;
        }
        const connection = createHostConnection(iceServers);
        peerConnectionsRef.current.set(participant.id, connection);
        const videoSender = connection.addTransceiver('video', { direction: 'sendonly' }).sender;
        const systemAudioSender = connection.addTransceiver('audio', { direction: 'sendonly' }).sender;
        const microphoneSender = connection.addTransceiver('audio', { direction: 'sendonly' }).sender;
        videoSendersRef.current.set(participant.id, videoSender);
        systemAudioSendersRef.current.set(participant.id, systemAudioSender);
        microphoneSendersRef.current.set(participant.id, microphoneSender);
        void negotiateHostConnection(
          socket,
          participant.id,
          connection,
          videoSender,
          systemAudioSender,
          microphoneSender,
          localStream?.getVideoTracks()[0] ?? null,
          localStream?.getAudioTracks()[0] ?? null,
          microphoneStream?.getAudioTracks()[0] ?? null,
          (status) => {
            setConnectionStates((current) => ({ ...current, [participant.id]: status }));
          },
        );
      }
    };
    void createHostConnections();
    return () => {
      cancelled = true;
    };
  }, [room, socket, localStream, microphoneStream]);

  useEffect(() => {
    const videoTrack = localStream?.getVideoTracks()[0] ?? null;
    for (const [peerId, sender] of videoSendersRef.current) {
      void sender.replaceTrack(videoTrack).catch(() => {
        setConnectionStates((current) => ({ ...current, [peerId]: 'failed' }));
      });
    }
  }, [localStream]);

  useEffect(() => {
    const systemAudioTrack = localStream?.getAudioTracks()[0] ?? null;
    for (const [peerId, sender] of systemAudioSendersRef.current) {
      void sender.replaceTrack(systemAudioTrack).catch(() => {
        setConnectionStates((current) => ({ ...current, [peerId]: 'failed' }));
      });
    }
  }, [localStream]);

  useEffect(() => {
    const microphoneTrack = microphoneStream?.getAudioTracks()[0] ?? null;
    for (const [peerId, sender] of microphoneSendersRef.current) {
      void sender.replaceTrack(microphoneTrack).catch(() => {
        setConnectionStates((current) => ({ ...current, [peerId]: 'failed' }));
      });
    }
  }, [microphoneStream]);

  return { connectionStates, remoteStreams };
}

function createHostConnection(iceServers: IceServerConfiguration[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers });
}

async function negotiateHostConnection(
  socket: SignalingClient,
  peerId: string,
  connection: RTCPeerConnection,
  videoSender: RTCRtpSender,
  systemAudioSender: RTCRtpSender,
  microphoneSender: RTCRtpSender,
  videoTrack: MediaStreamTrack | null,
  systemAudioTrack: MediaStreamTrack | null,
  microphoneTrack: MediaStreamTrack | null,
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

  let iceRestartAttempts = 0;
  let restartingIce = false;
  const restartIce = async () => {
    if (restartingIce || iceRestartAttempts >= 2) {
      return;
    }
    restartingIce = true;
    iceRestartAttempts += 1;
    try {
      if (connection.signalingState === 'have-local-offer') {
        await connection.setLocalDescription({ type: 'rollback' });
      }
      if (connection.signalingState !== 'stable') {
        return;
      }
      connection.restartIce();
      await sendHostOffer(socket, peerId, connection, true);
    } catch {
      updateStatus('failed');
    } finally {
      restartingIce = false;
    }
  };
  connection.oniceconnectionstatechange = () => {
    if (connection.iceConnectionState === 'failed') {
      updateStatus('failed');
      void restartIce();
    } else if (connection.iceConnectionState === 'disconnected') {
      updateStatus('disconnected');
    }
  };

  try {
    await Promise.all([
      videoSender.replaceTrack(videoTrack),
      systemAudioSender.replaceTrack(systemAudioTrack),
      microphoneSender.replaceTrack(microphoneTrack),
    ]);
    await sendHostOffer(socket, peerId, connection, false);
  } catch {
    updateStatus('failed');
  }
}

async function sendHostOffer(
  socket: SignalingClient,
  peerId: string,
  connection: RTCPeerConnection,
  iceRestart: boolean,
): Promise<void> {
  const offer = await connection.createOffer({ iceRestart });
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
}
