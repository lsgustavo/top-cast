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
import { getReconnectIdentity, type ReconnectIdentity } from './lib/reconnect-identity';

const SIGNALING_URL_STORAGE_KEY = 'topcast:signaling-url';
const DEFAULT_SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://127.0.0.1:3001';

function getSavedSignalingUrl(): string {
  return window.localStorage.getItem(SIGNALING_URL_STORAGE_KEY) ?? DEFAULT_SIGNALING_URL;
}

export default function App() {
  const [page, setPage] = useState<'home' | 'create-room' | 'join-room' | 'room'>('home');
  const [signalingServerUrl, setSignalingServerUrl] = useState(getSavedSignalingUrl);
  const [socket, setSocket] = useState(() => createSignalingClient(signalingServerUrl));
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

  function applySignalingServer(url: string) {
    setSignalingServerUrl(url);
    setSocket(createSignalingClient(url));
    try {
      window.localStorage.setItem(SIGNALING_URL_STORAGE_KEY, url);
      setHomeNotice('Endereço do servidor atualizado.');
    } catch (error) {
      setHomeNotice(
        error instanceof Error
          ? `Servidor atualizado, mas não foi possível salvar a configuração: ${error.message}`
          : 'Servidor atualizado, mas não foi possível salvar a configuração.',
      );
    }
  }
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
      if (activeRoom && !reconnectIdentityRef.current) {
        const participant = activeRoom.participants.find((candidate) => candidate.id === socket.id);
        if (participant) {
          reconnectIdentityRef.current = getReconnectIdentity(activeRoom, participant.id);
        }
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
          reconnectIdentityRef.current = getReconnectIdentity(result.room, socket.id);
          setPage('room');
          setHomeNotice('Conexão restaurada. A sala anterior foi encerrada; compartilhe o novo código de convite.');
        } else {
          const result = await requestRoomJoin(socket, identity.inviteCode, identity.displayName);
          if (!result.ok) {
            throw new Error(`Não foi possível reentrar na sala (${result.error}).`);
          }
          if (cancelled) return;
          setRoom(result.room);
          reconnectIdentityRef.current = getReconnectIdentity(result.room, socket.id);
          setPage('room');
          setHomeNotice('');
        }
      } catch (error) {
        if (cancelled) return;
        reconnectIdentityRef.current = null;
        setRoom(null);
        setPage('home');
        setHomeNotice(error instanceof Error ? error.message : 'Não foi possível restaurar a sala.');
      } finally {
        if (!cancelled) {
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
          reconnectIdentityRef.current = getReconnectIdentity(createdRoom, socket.id);
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
          reconnectIdentityRef.current = getReconnectIdentity(joinedRoom, socket.id);
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
        selfParticipantId={
          room.participants.find((participant) => participant.id === socket.id)?.id ??
          reconnectIdentityRef.current?.participantId ??
          null
        }
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
      signalingServerUrl={signalingServerUrl}
      onApplySignalingServer={applySignalingServer}
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
