import { useState } from 'react';
import { Button } from '../components/ui/button';
import { LoadingOverlay } from '../components/ui/loading-overlay';
import { createRoom } from '../lib/room-client';
import type { RoomSnapshot } from '../../shared/types/signaling';
import type { SignalingClient } from '../lib/signaling-client';

interface CreateRoomPageProps {
  socket: SignalingClient;
  displayName: string;
  onBack: () => void;
  onRoomCreated: (room: RoomSnapshot) => void;
}

const errorMessages: Record<string, string> = {
  ALREADY_IN_ROOM: 'Este cliente já está conectado a uma sala.',
  INVALID_NAME: 'O nome informado não é válido.',
  SERVER_ERROR: 'Não foi possível criar a sala. Verifique se o servidor está ativo e tente novamente.',
};

export default function CreateRoomPage({ socket, displayName, onBack, onRoomCreated }: CreateRoomPageProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setIsCreating(true);
    setError(null);
    try {
      const result = await createRoom(socket, displayName);
      if (!result.ok) {
        setError(result.error === 'ROOM_EXISTS'
          ? 'Já existe uma sala ativa no momento. Entre usando o código de convite.'
          : errorMessages[result.error] ?? 'Não foi possível criar a sala.');
        return;
      }
      onRoomCreated(result.room);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível conectar ao servidor de salas.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="relative flex h-full min-h-full items-center justify-center overflow-x-hidden bg-[#0b1020] px-5 py-6 text-slate-50 sm:px-8 sm:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.1),transparent_48%)]" />

      <section className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:p-8">
        <Button type="button" variant="ghost" disabled={isCreating} onClick={onBack} className="-ml-3 mb-7 text-slate-400 hover:text-slate-100">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mr-2 h-4 w-4">
            <path d="M15.5 10h-11m4 4-4-4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Voltar
        </Button>

        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-blue-400/15 bg-blue-500/10 text-blue-300">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Criar uma sala</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Vamos preparar uma sala privada. O código de convite será gerado pelo servidor e ficará válido por 24 horas.
        </p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Limite de participantes</span>
            <span className="font-medium text-slate-200">10 pessoas</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-400">Validade do convite</span>
            <span className="font-medium text-slate-200">24 horas</span>
          </div>
        </div>

        <div className="mt-5 min-h-12" aria-live="polite">
          {error && (
            <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm leading-5 text-red-200">
              {error}
            </p>
          )}
        </div>

        <Button
          type="button"
          size="lg"
          disabled={isCreating}
          onClick={() => void handleCreate()}
          className="w-full bg-blue-600 text-white hover:bg-blue-500"
        >
          {isCreating ? 'Criando sala…' : 'Criar sala'}
        </Button>
        <p className="mt-3 text-center text-xs text-slate-500">
          {isCreating ? 'Conectando ao servidor e gerando seu convite.' : 'A sala será criada assim que o servidor confirmar.'}
        </p>
      </section>

      {isCreating && (
        <LoadingOverlay
          title="Criando sala…"
          description="Configurando sessão de transmissão e gerando código de convite..."
        />
      )}
    </main>
  );
}
