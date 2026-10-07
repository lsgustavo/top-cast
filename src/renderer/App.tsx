import { useEffect, useRef, useState } from 'react';
import CreateRoomPage from './pages/CreateRoomPage';
import HomePage from './pages/HomePage';
import JoinRoomPage from './pages/JoinRoomPage';
import RoomPage from './pages/RoomPage';
import { createSignalingClient } from './lib/signaling-client';
import type { RoomSnapshot, SignalingStatus } from '../shared/types/signaling';
import { createRoom as requestRoomCreation, joinRoom as requestRoomJoin } from './lib/room-client';
import { useRoomWebRtc } from './features/streaming/use-room-webrtc';
import { useScreenCapture } from './features/streaming/use-screen-capture';
import { useMicrophone } from './features/streaming/use-microphone';

interface ReconnectIdentity {
  inviteCode: string;
  displayName: string;
  role: 'host' | 'guest';
}

export default function App() {
  const [page, setPage] = useState<'home' | 'create-room' | 'join-room' | 'room'>('home');
  const [socket] = useState(createSignalingClient);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [homeNotice, setHomeNotice] = useState('');
  const [signalingStatus, setSignalingStatus] = useState<SignalingStatus>('connected');
  const screenCapture = useScreenCapture();
  const microphone = useMicrophone();
  const [microphoneSyncError, setMicrophoneSyncError] = useState<string | null>(null);
  const roomRef = useRef(room);
  const hadSocketConnectionRef = useRef(false);
  const reconnectIdentityRef = useRef<ReconnectIdentity | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  roomRef.current = room;
  const { connectionStates, remoteStreams } = useRoomWebRtc(
    socket,
    room,
    screenCapture.stream,
    microphone.stream,
  );

  useEffect(() => {
    if (!room && (screenCapture.stream || microphone.stream)) {
      screenCapture.stopCapture();
      microphone.disable();
    }
  }, [room, screenCapture.stream, screenCapture.stopCapture, microphone.stream, microphone.disable]);

  useEffect(() => {
    const handleRoomUpdated = (updatedRoom: RoomSnapshot) => {
      setRoom((currentRoom) => currentRoom?.id === updatedRoom.id ? updatedRoom : currentRoom);
    };
    const handleRoomClosed = ({ reason }: { reason: 'host-left' | 'expired' }) => {
      reconnectIdentityRef.current = null;
      screenCapture.stopCapture();
      microphone.disable();
      setRoom(null);
      setPage('home');
      setHomeNotice(reason === 'expired' ? 'A sala expirou.' : 'O host encerrou a sala.');
    };

    socket.on('room:updated', handleRoomUpdated);
    socket.on('room:closed', handleRoomClosed);
    return () => {
      socket.off('room:updated', handleRoomUpdated);
      socket.off('room:closed', handleRoomClosed);
      socket.disconnect();
    };
  }, [socket, screenCapture.stopCapture, microphone.disable]);

  useEffect(() => {
    const handleConnect = () => {
      if (!hadSocketConnectionRef.current) {
        hadSocketConnectionRef.current = true;
        setSignalingStatus('connected');
        return;
      }
      if (reconnectIdentityRef.current) {
        setSignalingStatus('restoring');
        setReconnectAttempt((attempt) => attempt + 1);
      } else {
        setSignalingStatus('connected');
      }
    };
    const handleDisconnect = () => {
      const activeRoom = roomRef.current;
      const participant = activeRoom?.participants.find((candidate) => candidate.id === socket.id);
      if (activeRoom && participant) {
        reconnectIdentityRef.current = {
          inviteCode: activeRoom.inviteCode,
          displayName: participant.displayName,
          role: participant.role,
        };
      }
      setSignalingStatus('reconnecting');
    };
    const handleConnectError = () => setSignalingStatus('reconnecting');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);

  useEffect(() => {
    if (reconnectAttempt === 0) {
      return;
    }
    const identity = reconnectIdentityRef.current;
    if (!identity) {
      setSignalingStatus('connected');
      return;
    }

    let cancelled = false;
    const restoreRoom = async () => {
      try {
        if (identity.role === 'host') {
          const result = await requestRoomCreation(socket, identity.displayName);
          if (!result.ok) {
            throw new Error(`Não foi possível recriar sua sala (${result.error}).`);
          }
          if (cancelled) return;
          setRoom(result.room);
          setPage('room');
          setHomeNotice('Conexão restaurada. A sala anterior foi encerrada; compartilhe o novo código de convite.');
        } else {
          const result = await requestRoomJoin(socket, identity.inviteCode, identity.displayName);
          if (!result.ok) {
            throw new Error(`Não foi possível reentrar na sala (${result.error}).`);
          }
          if (cancelled) return;
          setRoom(result.room);
          setPage('room');
          setHomeNotice('');
        }
      } catch (error) {
        if (cancelled) return;
        setRoom(null);
        setPage('home');
        setHomeNotice(error instanceof Error ? error.message : 'Não foi possível restaurar a sala.');
      } finally {
        if (!cancelled) {
          reconnectIdentityRef.current = null;
          setSignalingStatus('connected');
        }
      }
    };

    void restoreRoom();
    return () => {
      cancelled = true;
    };
  }, [reconnectAttempt, socket]);

  useEffect(() => {
    if (!room || !socket.connected) {
      return;
    }
    socket.emit('room:microphone', { enabled: microphone.isEnabled }, (result) => {
      setMicrophoneSyncError(
        result.ok ? null : 'Não foi possível atualizar o estado do microfone na sala.',
      );
    });
  }, [microphone.isEnabled, room?.id, socket]);

  if (page === 'create-room') {
    return (
      <CreateRoomPage
        socket={socket}
        onBack={() => setPage('home')}
        onRoomCreated={(createdRoom) => {
          reconnectIdentityRef.current = null;
          setHomeNotice('');
          setRoom(createdRoom);
          setPage('room');
        }}
      />
    );
  }

  if (page === 'join-room') {
    return (
      <JoinRoomPage
        socket={socket}
        onBack={() => setPage('home')}
        onRoomJoined={(joinedRoom) => {
          reconnectIdentityRef.current = null;
          setHomeNotice('');
          setRoom(joinedRoom);
          setPage('room');
        }}
      />
    );
  }

  if (page === 'room' && room) {
    return (
      <RoomPage
        room={room}
        socket={socket}
        signalingStatus={signalingStatus}
        connectionStates={connectionStates}
        localStream={screenCapture.stream}
        remoteStreams={remoteStreams}
        captureSources={screenCapture.sources}
        isLoadingSources={screenCapture.isLoadingSources}
        isPreparingSource={screenCapture.isPreparingSource}
        isStartingCapture={screenCapture.isStartingCapture}
        preparedSourceId={screenCapture.preparedSourceId}
        includeSystemAudio={screenCapture.includeSystemAudio}
        supportsSystemAudio={screenCapture.supportsSystemAudio}
        hasSystemAudio={screenCapture.hasSystemAudio}
        systemAudioEnabled={screenCapture.systemAudioEnabled}
        isMicrophoneEnabled={microphone.isEnabled}
        isMicrophoneStarting={microphone.isStarting}
        captureError={screenCapture.error}
        microphoneError={microphone.error ?? microphoneSyncError}
        onLoadSources={screenCapture.loadSources}
        onPrepareSource={screenCapture.prepareSource}
        onStartCapture={screenCapture.startCapture}
        onStopCapture={screenCapture.stopCapture}
        onToggleSystemAudio={screenCapture.setSystemAudioEnabled}
        onToggleMicrophone={microphone.toggle}
        onDisableMicrophone={microphone.disable}
        onLeaveRequested={() => {
          reconnectIdentityRef.current = null;
        }}
        onLeave={() => {
          reconnectIdentityRef.current = null;
          screenCapture.stopCapture();
          microphone.disable();
          setRoom(null);
          setPage('home');
        }}
      />
    );
  }

  return (
    <HomePage
      notice={homeNotice}
      onCreateRoom={() => {
        setHomeNotice('');
        setPage('create-room');
      }}
      onJoinRoom={() => {
        setHomeNotice('');
        setPage('join-room');
      }}
    />
  );
}
