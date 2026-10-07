import { useState } from 'react';
import CreateRoomPage from './pages/CreateRoomPage';
import HomePage from './pages/HomePage';
import JoinRoomPage from './pages/JoinRoomPage';

export default function App() {
  const [page, setPage] = useState<'home' | 'create-room' | 'join-room'>('home');

  if (page === 'create-room') {
    return <CreateRoomPage onBack={() => setPage('home')} />;
  }

  if (page === 'join-room') {
    return <JoinRoomPage onBack={() => setPage('home')} />;
  }

  return (
    <HomePage
      onCreateRoom={() => setPage('create-room')}
      onJoinRoom={() => setPage('join-room')}
    />
  );
}
