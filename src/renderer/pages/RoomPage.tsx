import { useState } from 'react';
import { Button } from '../components/ui/button';
import type { RoomSnapshot } from '../../shared/types/signaling';
import type { SignalingClient } from '../lib/signaling-client';

interface RoomPageProps {
  room: RoomSnapshot;
  socket: SignalingClient;
  onLeave: () => void;
}

export default function RoomPage({ room, socket, onLeave }: RoomPageProps) {
  const [copyMessage, setCopyMessage] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const isHost = room.participants.some((participant) => participant.id === socket.id && participant.role === 'host');

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopyMessage('Código copiado.');
    } catch (error) {
      setCopyMessage(error instanceof Error ? `Não foi possível copiar: ${error.message}` : 'Não foi possível copiar o código.');
    }
  }

  function handleLeave() {
    setIsLeaving(true);
    socket.emit('room:leave', () => onLeave());
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1020] px-5 py-6 text-slate-50 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.1),transparent_48%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div>
            <h1 className="text-base font-semibold">Sala de transmissão</h1>
            <p className="mt-1 text-xs text-slate-500">{isHost ? 'Você é o host' : 'Você entrou como participante'}</p>
          </div>
          <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200">
            Conectado
          </span>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <section className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center shadow-xl shadow-black/10 sm:p-10">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-blue-400/15 bg-blue-500/10 text-blue-300">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Sala pronta</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Compartilhe o convite</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              Envie este código para as pessoas que deseja convidar. Ele expira em 24 horas.
            </p>

            <div className="mt-7 flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-5 py-4">
              <span className="font-mono text-2xl font-semibold tracking-[0.2em] text-slate-100">{room.inviteCode}</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopyCode()}>
                Copiar
              </Button>
            </div>
            <p aria-live="polite" className="mt-2 min-h-4 text-xs text-slate-400">{copyMessage}</p>

            {isHost ? (
              <Button type="button" size="lg" disabled className="mt-5 min-w-48 bg-blue-600 text-white">
                Iniciar transmissão
              </Button>
            ) : (
              <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
                Aguardando o host iniciar a transmissão.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">A captura de tela será habilitada em uma etapa posterior.</p>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Participantes</h2>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {room.participants.length} / {room.maxParticipants}
                </span>
              </div>

              <ul className="mt-4 space-y-2">
                {room.participants.map((participant) => (
                  <li key={participant.id} className="flex items-center gap-3 rounded-xl bg-slate-950/40 p-3">
                    <div className={`grid h-10 w-10 place-items-center rounded-full ${participant.role === 'host' ? 'bg-blue-500/15 text-blue-200' : 'bg-slate-800 text-slate-300'}`}>
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M5.5 20c.5-3.4 2.7-5.2 6.5-5.2s6 1.8 6.5 5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{participant.displayName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{participant.role === 'host' ? 'Host' : 'Participante'}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Conectado" />
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs font-medium text-slate-300">Convite válido até</p>
              <p className="mt-1 text-sm text-slate-400">{new Date(room.expiresAt).toLocaleString()}</p>
            </section>

            <Button
              type="button"
              variant="outline"
              disabled={isLeaving}
              onClick={handleLeave}
              className="w-full border-slate-700 text-slate-300 hover:border-red-400/30 hover:bg-red-400/[0.06] hover:text-red-200"
            >
              {isLeaving ? 'Saindo…' : isHost ? 'Encerrar sala' : 'Sair da sala'}
            </Button>
          </aside>
        </div>
      </div>
    </main>
  );
}
