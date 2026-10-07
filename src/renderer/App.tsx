import { useEffect, useState } from 'react';
import CreateRoomPage from './pages/CreateRoomPage';
import HomePage from './pages/HomePage';
import JoinRoomPage from './pages/JoinRoomPage';
import RoomPage from './pages/RoomPage';
import { createSignalingClient } from './lib/signaling-client';
import type { RoomSnapshot } from '../shared/types/signaling';
import { useRoomWebRtc } from './features/streaming/use-room-webrtc';
import { useScreenCapture } from './features/streaming/use-screen-capture';
import { useMicrophone } from './features/streaming/use-microphone';

export default function App() {
  const [page, setPage] = useState<'home' | 'create-room' | 'join-room' | 'room'>('home');
  const [socket] = useState(createSignalingClient);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [homeNotice, setHomeNotice] = useState('');
  const screenCapture = useScreenCapture();
  const microphone = useMicrophone();
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

  if (page === 'create-room') {
    return (
      <CreateRoomPage
        socket={socket}
        onBack={() => setPage('home')}
        onRoomCreated={(createdRoom) => {
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
        microphoneError={microphone.error}
        onLoadSources={screenCapture.loadSources}
        onPrepareSource={screenCapture.prepareSource}
        onStartCapture={screenCapture.startCapture}
        onStopCapture={screenCapture.stopCapture}
        onToggleSystemAudio={screenCapture.setSystemAudioEnabled}
        onToggleMicrophone={microphone.toggle}
        onDisableMicrophone={microphone.disable}
        onLeave={() => {
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
