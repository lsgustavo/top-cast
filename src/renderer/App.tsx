import { useEffect, useRef, useState } from 'react';
import CreateRoomPage from './pages/CreateRoomPage';
import HomePage from './pages/HomePage';
import JoinRoomPage from './pages/JoinRoomPage';
import RoomPage from './pages/RoomPage';
import { createSignalingClient } from './lib/signaling-client';
import type { RoomAvailability, RoomSnapshot, SignalingStatus } from '../shared/types/signaling';
import { createRoom as requestRoomCreation, joinRoom as requestRoomJoin } from './lib/room-client';
import { useRoomWebRtc } from './features/streaming/use-room-webrtc';
import { useScreenCapture } from './features/streaming/use-screen-capture';
import { getReconnectIdentity, type ReconnectIdentity } from './lib/reconnect-identity';
import { getParticipantChanges } from './lib/participant-events';
import { playPresenceSound } from './lib/presence-sound';
import { TooltipProvider } from './components/ui/tooltip';
import { LoadingOverlay } from './components/ui/loading-overlay';

const SIGNALING_URL_STORAGE_KEY = 'topcast:signaling-url';
const DISPLAY_NAME_STORAGE_KEY = 'topcast:display-name';
const DEFAULT_SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://127.0.0.1:3001';

function getSavedSignalingUrl(): string {
  return window.localStorage.getItem(SIGNALING_URL_STORAGE_KEY) ?? DEFAULT_SIGNALING_URL;
}

function getSavedDisplayName(): string {
  return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? '';
}

export default function App() {
  const [page, setPage] = useState<'home' | 'create-room' | 'join-room' | 'room'>('home');
  const [signalingServerUrl, setSignalingServerUrl] = useState(getSavedSignalingUrl);
  const [socket, setSocket] = useState(() => createSignalingClient(signalingServerUrl));
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [displayName, setDisplayName] = useState(getSavedDisplayName);
  const [roomAvailability, setRoomAvailability] = useState<RoomAvailability['active'] | null>(null);
  const [homeNotice, setHomeNotice] = useState('');
  const [signalingStatus, setSignalingStatus] = useState<SignalingStatus>('connected');
  const screenCapture = useScreenCapture();
  const roomRef = useRef(room);
  const hadSocketConnectionRef = useRef(false);
  const reconnectIdentityRef = useRef<ReconnectIdentity | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  roomRef.current = room;

  function applySignalingServer(url: string) {
    setRoomAvailability(null);
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

  function updateDisplayName(name: string) {
    setDisplayName(name.slice(0, 32));
    try {
      window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name.slice(0, 32));
    } catch (error) {
      setHomeNotice(error instanceof Error
        ? `Nome atualizado, mas não foi possível salvá-lo: ${error.message}`
        : 'Nome atualizado, mas não foi possível salvá-lo.');
    }
  }
  const { connectionStates, remoteStreams } = useRoomWebRtc(
    socket,
    room,
    screenCapture.stream,
  );

  useEffect(() => {
    if (!room && screenCapture.stream) {
      screenCapture.stopCapture();
    }
  }, [room, screenCapture.stream, screenCapture.stopCapture]);

  useEffect(() => {
    const self = room?.participants.find((participant) => participant.id === socket.id);
    if (self?.role !== 'host' && screenCapture.stream) {
      screenCapture.stopCapture();
    }
  }, [
    room,
    socket.id,
    screenCapture.stream,
    screenCapture.stopCapture,
  ]);

  useEffect(() => {
    const handleRoomUpdated = (updatedRoom: RoomSnapshot) => {
      const changes = getParticipantChanges(roomRef.current, updatedRoom);
      if (changes.joined.length > 0) {
        playPresenceSound('joined');
        for (const participant of changes.joined) {
          if (participant.id === socket.id || !window.topCast?.notifyParticipantJoined) {
            continue;
          }
          void window.topCast.notifyParticipantJoined(participant.displayName).catch((error: unknown) => {
            console.warn('Could not show participant system notification', error);
          });
        }
      } else if (changes.left.length > 0) {
        playPresenceSound('left');
      }
      setRoom((currentRoom) => currentRoom?.id === updatedRoom.id ? updatedRoom : currentRoom);
    };
    const handleRoomAvailability = ({ active }: RoomAvailability) => setRoomAvailability(active);
    const handleRoomClosed = ({ reason }: { reason: 'host-left' | 'expired' }) => {
      playPresenceSound('left');
      reconnectIdentityRef.current = null;
      screenCapture.stopCapture();
      setRoom(null);
      setPage('home');
      setHomeNotice(reason === 'expired' ? 'A sala expirou.' : 'O host encerrou a sala.');
    };
    const handleKicked = () => {
      reconnectIdentityRef.current = null;
      screenCapture.stopCapture();
      setRoom(null);
      setPage('home');
      setHomeNotice('O host removeu você da sala.');
    };

    socket.on('room:availability', handleRoomAvailability);
    socket.on('room:updated', handleRoomUpdated);
    socket.on('room:closed', handleRoomClosed);
    socket.on('room:kicked', handleKicked);
    return () => {
      socket.off('room:availability', handleRoomAvailability);
      socket.off('room:updated', handleRoomUpdated);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:kicked', handleKicked);
      socket.disconnect();
    };
  }, [socket, screenCapture.stopCapture]);

  useEffect(() => {
    const removeShortcutListener = window.topCast?.onLeaveRoomShortcut(() => {
      const activeRoom = roomRef.current;
      if (!activeRoom) {
        return;
      }
      reconnectIdentityRef.current = null;
      screenCapture.stopCapture();
      socket.emit('room:leave', () => undefined);
      setRoom(null);
      setPage('home');
      setHomeNotice('Você saiu da sala pelo atalho Ctrl+Shift+L.');
    });
    return () => removeShortcutListener?.();
  }, [socket, screenCapture.stopCapture]);

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
    socket.connect();
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
        let result = await requestRoomJoin(socket, identity.inviteCode, identity.displayName);
        if (
          !result.ok &&
          identity.role === 'host' &&
          (result.error === 'INVALID_CODE' || result.error === 'ROOM_EXPIRED')
        ) {
          result = await requestRoomCreation(socket, identity.displayName);
        }
        if (!result.ok) {
          throw new Error(`Não foi possível restaurar sua sala (${result.error}).`);
        }
        if (cancelled) return;
        setRoom(result.room);
        reconnectIdentityRef.current = getReconnectIdentity(result.room, socket.id);
        setPage('room');
        setHomeNotice(identity.role === 'host' && result.room.participants.find((participant) => participant.id === socket.id)?.role === 'guest'
          ? 'Você voltou à sala como participante; o host foi transferido.'
          : identity.role === 'host'
            ? 'Conexão restaurada; uma nova sala foi criada. Compartilhe o novo convite.'
            : '');
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

  let pageContent = null;

  if (page === 'create-room') {
    pageContent = (
      <CreateRoomPage
        socket={socket}
        displayName={displayName}
        onBack={() => setPage('home')}
        onRoomCreated={(createdRoom) => {
          reconnectIdentityRef.current = getReconnectIdentity(createdRoom, socket.id);
          setHomeNotice('');
          setRoom(createdRoom);
          setPage('room');
        }}
      />
    );
  } else if (page === 'join-room') {
    pageContent = (
      <JoinRoomPage
        socket={socket}
        displayName={displayName}
        onBack={() => setPage('home')}
        onRoomJoined={(joinedRoom) => {
          reconnectIdentityRef.current = getReconnectIdentity(joinedRoom, socket.id);
          setHomeNotice('');
          setRoom(joinedRoom);
          setPage('room');
        }}
      />
    );
  } else if (page === 'room' && room) {
    pageContent = (
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
        captureError={screenCapture.error}
        onLoadSources={screenCapture.loadSources}
        onPrepareSource={screenCapture.prepareSource}
        onSetIncludeSystemAudio={screenCapture.setIncludeSystemAudio}
        onStartCapture={screenCapture.startCapture}
        onStopCapture={screenCapture.stopCapture}
        onToggleSystemAudio={screenCapture.setSystemAudioEnabled}
        onLeaveRequested={() => {
          reconnectIdentityRef.current = null;
        }}
        onLeave={() => {
          reconnectIdentityRef.current = null;
          screenCapture.stopCapture();
          setRoom(null);
          setPage('home');
        }}
      />
    );
  } else {
    pageContent = (
      <HomePage
        notice={homeNotice}
        signalingServerUrl={signalingServerUrl}
        displayName={displayName}
        roomIsActive={roomAvailability}
        onDisplayNameChange={updateDisplayName}
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

  return (
    <TooltipProvider delayDuration={200}>
      {pageContent}
      {signalingStatus === 'restoring' && (
        <LoadingOverlay
          title="Restaurando sessão…"
          description="Reconectando à sala de transmissão"
        />
      )}
    </TooltipProvider>
  );
}
