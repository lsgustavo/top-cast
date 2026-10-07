import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { APP_NAME } from '../../shared/constants/app';
import { joinRoom } from '../lib/room-client';
import type { RoomSnapshot } from '../../shared/types/signaling';
import type { SignalingClient } from '../lib/signaling-client';

interface JoinRoomPageProps {
  socket: SignalingClient;
  onBack: () => void;
  onRoomJoined: (room: RoomSnapshot) => void;
}

type SubmissionState = 'idle' | 'invalid' | 'server-error' | 'loading';

const roomErrorMessages: Record<string, string> = {
  INVALID_CODE: 'Código inválido ou sala inexistente.',
  ROOM_EXPIRED: 'Esta sala expirou.',
  ROOM_FULL: 'Esta sala já atingiu o limite de participantes.',
  ALREADY_IN_ROOM: 'Este cliente já está conectado a uma sala.',
  INVALID_NAME: 'O nome informado não é válido.',
  RATE_LIMITED: 'Muitas tentativas de entrada. Aguarde um minuto antes de tentar novamente.',
  SERVER_ERROR: 'Não foi possível verificar a sala. Verifique sua conexão e tente novamente.',
};

function formatInviteCode(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return normalized.length > 4
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

function ScreenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function JoinRoomPage({ socket, onBack, onRoomJoined }: JoinRoomPageProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const isCodeComplete = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(inviteCode);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCodeComplete) {
      setSubmissionState('invalid');
      return;
    }

    setSubmissionState('loading');
    setErrorMessage('');
    try {
      const result = await joinRoom(socket, inviteCode, 'Participante');
      if (!result.ok) {
        setSubmissionState('server-error');
        setErrorMessage(roomErrorMessages[result.error] ?? 'Não foi possível entrar na sala.');
        return;
      }
      onRoomJoined(result.room);
    } catch (cause) {
      setSubmissionState('server-error');
      setErrorMessage(cause instanceof Error ? cause.message : 'Não foi possível conectar ao servidor de salas.');
    }
  }

  function handleCodeChange(value: string) {
    setInviteCode(formatInviteCode(value));
    setSubmissionState('idle');
    setErrorMessage('');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1020] px-5 py-8 text-slate-50 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.1),transparent_48%)]" />

      <div className="relative w-full max-w-[480px]">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
              <ScreenIcon />
            </div>
            <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={submissionState === 'loading'}
            onClick={onBack}
            className="text-slate-400 hover:text-slate-100"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mr-2 h-4 w-4">
              <path d="M15.5 10h-11m4 4-4-4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar
          </Button>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-400/15 bg-blue-500/10 text-blue-300">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M10 14a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 5.34l-1.72 1.72" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1.72-1.72" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Entrar em uma sala</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Digite o código de convite recebido do host para encontrar a sala.
          </p>

          <form onSubmit={handleSubmit} className="mt-7">
            <label htmlFor="invite-code" className="mb-2 block text-sm font-medium text-slate-200">
              Código da sala
            </label>
            <input
              id="invite-code"
              name="inviteCode"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={9}
              placeholder="AB7K-92PX"
              value={inviteCode}
              onChange={(event) => handleCodeChange(event.target.value)}
              aria-describedby="invite-code-hint invite-code-status"
              aria-invalid={submissionState === 'invalid'}
              className="h-14 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-center font-mono text-xl tracking-[0.18em] text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-blue-400/70 focus:ring-2 focus:ring-blue-400/15"
            />
            <p id="invite-code-hint" className="mt-2 text-xs text-slate-500">
              O código tem 8 letras ou números. O hífen é inserido automaticamente.
            </p>

            <div id="invite-code-status" aria-live="polite" className="mt-4 min-h-12">
              {submissionState === 'invalid' && (
                <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200">
                  Informe um código completo no formato XXXX-XXXX.
                </p>
              )}
              {submissionState === 'server-error' && (
                <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm leading-5 text-red-200">
                  {errorMessage}
                </p>
              )}
              {submissionState === 'loading' && (
                <p role="status" className="rounded-lg border border-blue-400/15 bg-blue-400/[0.05] px-3 py-2.5 text-sm text-blue-100">
                  Conectando ao servidor e verificando o convite…
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!isCodeComplete || submissionState === 'loading'}
              className="mt-2 w-full bg-blue-600 text-white hover:bg-blue-500"
            >
              {submissionState === 'loading' ? 'Verificando…' : 'Entrar na sala'}
            </Button>
          </form>
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-slate-600">
          A existência, validade e disponibilidade de vagas são verificadas pelo servidor.
        </p>
      </div>
    </main>
  );
}
