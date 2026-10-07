import { useEffect, useState } from 'react';
import CreateRoomPage from './pages/CreateRoomPage';
import HomePage from './pages/HomePage';
import JoinRoomPage from './pages/JoinRoomPage';
import RoomPage from './pages/RoomPage';
import { createSignalingClient } from './lib/signaling-client';
import type { RoomSnapshot } from '../shared/types/signaling';
import { useRoomWebRtc } from './features/streaming/use-room-webrtc';
import { useScreenCapture } from './features/streaming/use-screen-capture';

export default function App() {
  const [page, setPage] = useState<'home' | 'create-room' | 'join-room' | 'room'>('home');
  const [socket] = useState(createSignalingClient);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [homeNotice, setHomeNotice] = useState('');
  const screenCapture = useScreenCapture();
  const { connectionStates, remoteStreams } = useRoomWebRtc(socket, room, screenCapture.stream);

  useEffect(() => {
    if (!room && screenCapture.stream) {
      screenCapture.stopCapture();
    }
  }, [room, screenCapture.stream, screenCapture.stopCapture]);

  useEffect(() => {
    const handleRoomUpdated = (updatedRoom: RoomSnapshot) => {
      setRoom((currentRoom) => currentRoom?.id === updatedRoom.id ? updatedRoom : currentRoom);
    };
    const handleRoomClosed = ({ reason }: { reason: 'host-left' | 'expired' }) => {
      screenCapture.stopCapture();
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
  }, [socket, screenCapture.stopCapture]);

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
        captureError={screenCapture.error}
        onLoadSources={screenCapture.loadSources}
        onPrepareSource={screenCapture.prepareSource}
        onStartCapture={screenCapture.startCapture}
        onStopCapture={screenCapture.stopCapture}
        onLeave={() => {
          screenCapture.stopCapture();
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
