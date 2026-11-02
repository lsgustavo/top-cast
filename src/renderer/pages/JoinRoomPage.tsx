import { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Monitor } from 'lucide-react';
import { Button } from '../components/ui/button';
import { LoadingOverlay } from '../components/ui/loading-overlay';
import { APP_NAME } from '../../shared/constants/app';
import { joinRoom } from '../lib/room-client';
import { getOrCreateLocalAvatarSeed } from '../lib/voxel-avatar';
import type { RoomSnapshot } from '../../shared/types/signaling';
import type { SignalingClient } from '../lib/signaling-client';

interface JoinRoomPageProps {
  socket: SignalingClient;
  displayName: string;
  onBack: () => void;
  onRoomJoined: (room: RoomSnapshot) => void;
}

type SubmissionState = 'idle' | 'invalid' | 'server-error' | 'loading';

const roomErrorMessages: Record<string, string> = {
  ROOM_EXISTS: 'Já existe uma sala ativa. Entre com o código de convite dela.',
  INVALID_CODE: 'Código inválido ou sala inexistente.',
  ROOM_EXPIRED: 'Esta sala expirou.',
  ROOM_FULL: 'Esta sala já atingiu o limite de participantes.',
  ALREADY_IN_ROOM: 'Este cliente já está conectado a uma sala.',
  INVALID_NAME: 'O nome informado não é válido.',
  RATE_LIMITED: 'Muitas tentativas de entrada. Aguarde um minuto antes de tentar novamente.',
  SERVER_ERROR: 'Não foi possível verificar a sala. Verifique sua conexão e tente novamente.',
};

function formatInviteCode(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return normalized.length > 3
    ? `${normalized.slice(0, 3)}-${normalized.slice(3)}`
    : normalized;
}

export default function JoinRoomPage({ socket, displayName, onBack, onRoomJoined }: JoinRoomPageProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const isCodeComplete = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(inviteCode);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCodeComplete) {
      setSubmissionState('invalid');
      return;
    }

    setSubmissionState('loading');
    setErrorMessage('');
    try {
      const avatarSeed = getOrCreateLocalAvatarSeed();
      const result = await joinRoom(socket, inviteCode, displayName, avatarSeed);
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
    <main className="relative flex h-full min-h-full items-center justify-center overflow-x-hidden bg-background px-5 py-6 text-slate-50 sm:px-8 sm:py-8">
      {/* Luz ambiente e textura de fundo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.12),transparent_55%)]" />

      <div className="relative w-full max-w-[480px]">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
              <Monitor className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-100">{APP_NAME}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submissionState === 'loading'}
            onClick={onBack}
            className="h-8 gap-2 rounded-xl border border-border/40 bg-slate-900/60 px-3 text-xs font-medium text-slate-300 transition-all hover:border-border/80 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar</span>
          </Button>
        </header>

        <section className="rounded-3xl p-6 sm:p-8 glass-surface-elevated">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <KeyRound className="h-5 w-5" />
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">Entrar em uma sala</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
            Digite o código de convite recebido do host para encontrar a sala.
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="invite-code" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Código da sala
            </label>
            <input
              id="invite-code"
              name="inviteCode"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={7}
              placeholder="AB7-92P"
              value={inviteCode}
              onChange={(event) => handleCodeChange(event.target.value)}
              aria-describedby="invite-code-hint invite-code-status"
              aria-invalid={submissionState === 'invalid'}
              className="h-14 w-full rounded-xl border border-border/30 bg-slate-950/60 px-4 text-center font-mono text-xl tracking-[0.18em] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
            <p id="invite-code-hint" className="mt-2 text-xs text-slate-500">
              O código tem 6 letras ou números. O hífen é inserido automaticamente.
            </p>

            <div id="invite-code-status" aria-live="polite" className="mt-3.5 min-h-12">
              {submissionState === 'invalid' && (
                <p role="alert" className="rounded-xl border border-red-500/20 bg-red-400/10 px-3.5 py-2.5 text-xs text-red-200">
                  Informe um código completo no formato XXX-XXX.
                </p>
              )}
              {submissionState === 'server-error' && (
                <p role="alert" className="rounded-xl border border-red-500/20 bg-red-400/10 px-3.5 py-2.5 text-xs leading-5 text-red-200">
                  {errorMessage}
                </p>
              )}
              {submissionState === 'loading' && (
                <p role="status" className="rounded-xl border border-blue-500/20 bg-blue-400/10 px-3.5 py-2.5 text-xs text-blue-200">
                  Conectando ao servidor e verificando o convite…
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!isCodeComplete || displayName.trim().length === 0 || submissionState === 'loading'}
              className="mt-2 w-full rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {submissionState === 'loading' ? 'Verificando…' : 'Entrar na sala'}
            </Button>
          </form>
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          A existência, validade e disponibilidade de vagas são verificadas pelo servidor.
        </p>
      </div>

      {submissionState === 'loading' && (
        <LoadingOverlay
          title="Entrando na sala…"
          description="Verificando código de convite e conectando aos participantes..."
        />
      )}
    </main>
  );
}
