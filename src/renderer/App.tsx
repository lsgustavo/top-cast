import { useEffect, useState } from 'react';
import CreateRoomPage from './pages/CreateRoomPage';
import HomePage from './pages/HomePage';
import JoinRoomPage from './pages/JoinRoomPage';
import RoomPage from './pages/RoomPage';
import { createSignalingClient } from './lib/signaling-client';
import type { RoomSnapshot } from '../shared/types/signaling';
import { useRoomWebRtc } from './features/streaming/use-room-webrtc';

export default function App() {
  const [page, setPage] = useState<'home' | 'create-room' | 'join-room' | 'room'>('home');
  const [socket] = useState(createSignalingClient);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [homeNotice, setHomeNotice] = useState('');
  const connectionStates = useRoomWebRtc(socket, room);

  useEffect(() => {
    const handleRoomUpdated = (updatedRoom: RoomSnapshot) => {
      setRoom((currentRoom) => currentRoom?.id === updatedRoom.id ? updatedRoom : currentRoom);
    };
    const handleRoomClosed = ({ reason }: { reason: 'host-left' | 'expired' }) => {
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
  }, [socket]);

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
        onLeave={() => {
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
