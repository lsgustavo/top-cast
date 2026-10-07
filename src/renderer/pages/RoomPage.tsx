import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  AppWindow,
  Check,
  CircleAlert,
  Copy,
  Crown,
  LogOut,
  Monitor,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { formatRoomTimeRemaining, getParticipantAvatarHue, getParticipantInitials } from '../lib/room-ui';
import type { RoomSnapshot } from '../../shared/types/signaling';
import type { CaptureSource } from '../../shared/types/desktop-api';
import type { SignalingStatus } from '../../shared/types/signaling';
import type { SignalingClient } from '../lib/signaling-client';
import type { PeerConnectionStatus } from '../features/streaming/use-room-webrtc';

interface RoomPageProps {
  room: RoomSnapshot;
  socket: SignalingClient;
  selfParticipantId: string | null;
  signalingStatus: SignalingStatus;
  connectionStates: Record<string, PeerConnectionStatus>;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  captureSources: CaptureSource[];
  isLoadingSources: boolean;
  isPreparingSource: boolean;
  isStartingCapture: boolean;
  preparedSourceId: string | null;
  includeSystemAudio: boolean;
  supportsSystemAudio: boolean;
  hasSystemAudio: boolean;
  systemAudioEnabled: boolean;
  captureError: string | null;
  onLoadSources: () => Promise<CaptureSource[]>;
  onPrepareSource: (sourceId: string | null, includeSystemAudio?: boolean) => Promise<boolean>;
  onStartCapture: () => Promise<boolean>;
  onStopCapture: () => void;
  onToggleSystemAudio: (enabled: boolean) => void;
  onLeaveRequested: () => void;
  onLeave: () => void;
}

function StreamVideo({ stream, muted = false }: { stream: MediaStream; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.srcObject = stream;
    }
    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="h-full w-full bg-black object-contain"
    />
  );
}

function ScreenIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function RoomPage({
  room,
  socket,
  selfParticipantId,
  signalingStatus,
  connectionStates,
  localStream,
  remoteStreams,
  captureSources,
  isLoadingSources,
  isPreparingSource,
  isStartingCapture,
  preparedSourceId,
  includeSystemAudio,
  supportsSystemAudio,
  hasSystemAudio,
  systemAudioEnabled,
  captureError,
  onLoadSources,
  onPrepareSource,
  onStartCapture,
  onStopCapture,
  onToggleSystemAudio,
  onLeaveRequested,
  onLeave,
}: RoomPageProps) {
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [isCopied, setIsCopied] = useState(false);
  const [participantActionError, setParticipantActionError] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const toastTimerRef = useRef<number | null>(null);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<CaptureSource['kind']>('screen');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const isHost = room.participants.some((participant) => participant.id === selfParticipantId && participant.role === 'host');
  const host = room.participants.find((participant) => participant.role === 'host');
  const remoteHostStream = host ? remoteStreams[host.id] ?? null : null;
  const presentationStream = isHost ? localStream : remoteHostStream;
  const isReceivingVideo = presentationStream !== null && (
    isHost || presentationStream.getVideoTracks().some((track) => !track.muted && track.readyState === 'live')
  );
  const filteredSources = captureSources.filter((source) => source.kind === sourceKind);
  const signalingStatusLabels: Record<SignalingStatus, string> = {
    connected: 'Conectado',
    reconnecting: 'Reconectando…',
    restoring: 'Restaurando sala…',
  };
  const rtcConnectedCount = Object.values(connectionStates).filter((status) => status === 'connected').length;
  const isRoomConnected = signalingStatus === 'connected' && (
    room.participants.length <= 1 || rtcConnectedCount > 0
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      window.clearInterval(timer);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  async function handleCopyCode() {
    let duration = 2_000;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setIsCopied(true);
      setToastTone('success');
      setToastMessage('Código copiado para a área de transferência!');
    } catch (error) {
      duration = 4_500;
      setIsCopied(false);
      setToastTone('error');
      const message = error instanceof Error
        ? `Não foi possível copiar o código: ${error.message}`
        : 'Não foi possível copiar o código.';
      setToastMessage(message);
    }
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
      setIsCopied(false);
    }, duration);
  }

  function handlePresenceChange(value: string) {
    if (value !== 'available' && value !== 'away' && value !== 'busy') {
      setParticipantActionError('Estado de presença inválido.');
      return;
    }
    setParticipantActionError('');
    socket.emit('room:presence', { presence: value }, (result) => {
      if (!result.ok) {
        setParticipantActionError('Não foi possível atualizar seu estado de presença.');
      }
    });
  }

  function handleKick(participantId: string, displayName: string) {
    if (!window.confirm(`Remover ${displayName} da sala?`)) {
      return;
    }
    setParticipantActionError('');
    socket.emit('room:kick', { participantId }, (result) => {
      if (!result.ok) {
        setParticipantActionError(
          result.error === 'NOT_HOST'
            ? 'Somente o host pode remover participantes.'
            : 'Não foi possível remover esse participante.',
        );
      }
    });
  }

  function openSourcePicker() {
    setSelectedSourceId(null);
    void onPrepareSource(null, false);
    setIsSourcePickerOpen(true);
    void onLoadSources();
  }

  async function handleSelectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    if (!await onPrepareSource(sourceId, includeSystemAudio)) {
      setSelectedSourceId(null);
    }
  }

  function closeSourcePicker() {
    setSelectedSourceId(null);
    void onPrepareSource(null, false);
    setIsSourcePickerOpen(false);
  }

  async function handleStartCapture() {
    if (!selectedSourceId || preparedSourceId !== selectedSourceId) {
      return;
    }
    const started = await onStartCapture();
    if (started) {
      setIsSourcePickerOpen(false);
    }
  }

  function handleLeave() {
    setIsLeaving(true);
    onLeaveRequested();
    onStopCapture();
    socket.emit('room:leave', () => onLeave());
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0b1020] text-slate-50 lg:h-screen lg:flex-row lg:overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.1),transparent_48%)]" />

      <aside className="relative z-10 flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-950/70 p-4 sm:p-5 lg:h-screen lg:min-h-0 lg:w-[292px] lg:border-b-0 lg:border-r lg:px-3 lg:py-4">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4 [-webkit-app-region:drag]">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
            <ScreenIcon />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">TopCast</h1>
            <p className="mt-0.5 text-xs text-slate-500">Sala de transmissão</p>
          </div>
        </div>

        <section aria-label="Convite da sala" className="mt-3 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Convite</h2>
            <span className="text-[10px] font-medium text-slate-400">Expira em {formatRoomTimeRemaining(room.expiresAt, now)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-950/60 p-1.5 pl-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-widest text-blue-200">{room.inviteCode}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void handleCopyCode()}
              aria-label={isCopied ? 'Código copiado' : 'Copiar código do convite'}
              title={isCopied ? 'Copiado!' : 'Copiar código'}
              className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">Validade: {new Date(room.expiresAt).toLocaleString()}</p>
        </section>

        <section aria-labelledby="participants-heading" className="mt-5 flex min-h-24 flex-1 flex-col lg:min-h-0">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 id="participants-heading" className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Participantes</h2>
            <span className="text-[11px] tabular-nums text-slate-500">{room.participants.length}/{room.maxParticipants}</span>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5 overflow-y-auto">
            {room.participants.map((participant) => {
              const isSelf = participant.id === selfParticipantId;
              const avatarHue = getParticipantAvatarHue(participant.displayName);
              const initials = getParticipantInitials(participant.displayName);
              const presenceColor = participant.presence === 'available'
                ? 'bg-emerald-400'
                : participant.presence === 'away' ? 'bg-amber-300' : 'bg-red-400';
              const presenceLabel = participant.presence === 'available'
                ? 'Online'
                : participant.presence === 'away' ? 'Ausente' : 'Ocupado';

              return (
                <li key={participant.id} className="group flex items-center justify-between gap-3 rounded-md border border-slate-700/60 bg-slate-900/50 p-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-xs font-semibold text-white"
                      style={{ backgroundColor: `hsl(${avatarHue} 42% 36%)` }}
                      role="img"
                      aria-label={`${participant.displayName}, ${presenceLabel}`}
                    >
                      {initials}
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${presenceColor}`} />
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-slate-200">{participant.displayName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {participant.role === 'host' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        <Crown className="h-3 w-3" />Host
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded-full border border-blue-400/30 bg-blue-400/15 px-2 py-0.5 text-[11px] font-medium text-blue-200">Você</span>
                    )}
                    {!isSelf && participant.role !== 'host' && (
                      <span className="rounded-full border border-slate-600/70 bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium text-slate-400">Convidado</span>
                    )}
                  </div>
                  {isHost && !isSelf && participant.role !== 'host' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${participant.displayName}`}
                      title={`Remover ${participant.displayName}`}
                      onClick={() => handleKick(participant.id, participant.displayName)}
                      className="h-7 w-7 shrink-0 text-slate-500 hover:bg-red-400/10 hover:text-red-200"
                    >
                      <RemoveParticipantIcon />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {participantActionError && (
            <p role="alert" className="mt-2 inline-flex w-fit max-w-full self-start items-start gap-2 break-words rounded-md border border-red-400/20 bg-red-400/[0.06] px-2.5 py-2 text-xs leading-5 text-red-200">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {participantActionError}
            </p>
          )}
        </section>

        <div className="mt-4 border-t border-slate-800 pt-3 lg:mt-3">
          <section aria-label="Áudio da transmissão" className="rounded-lg border border-slate-700/50 bg-slate-900/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                <span className={`h-1.5 w-1.5 rounded-full ${isRoomConnected ? 'bg-emerald-400' : 'bg-amber-300'}`} />
                {isRoomConnected
                  ? rtcConnectedCount > 0 ? 'Sala conectada · RTC OK' : 'Sinalização conectada'
                  : signalingStatusLabels[signalingStatus]}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={systemAudioEnabled ? 'Desativar áudio da transmissão' : 'Ativar áudio da transmissão'}
                aria-pressed={systemAudioEnabled}
                disabled={!isHost || !hasSystemAudio}
                onClick={() => onToggleSystemAudio(!systemAudioEnabled)}
                className={`h-9 w-9 rounded-full ${systemAudioEnabled ? 'bg-blue-400/15 text-blue-300 hover:bg-blue-400/25' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                {systemAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
            {!supportsSystemAudio && (
              <p className="mt-2 text-center text-[10px] leading-4 text-slate-500">Áudio do sistema indisponível nesta plataforma.</p>
            )}
          </section>

          <div className="mt-3 border-t border-slate-800 pt-3">
            {room.participants.filter((participant) => participant.id === selfParticipantId).map((participant) => {
            const avatarHue = getParticipantAvatarHue(participant.displayName);
            const initials = getParticipantInitials(participant.displayName);
            const presenceColor = participant.presence === 'available'
              ? 'bg-emerald-400'
              : participant.presence === 'away' ? 'bg-amber-300' : 'bg-red-400';
            const presenceLabel = participant.presence === 'available'
              ? 'Disponível'
              : participant.presence === 'away' ? 'Ausente' : 'Ocupado';

            return (
              <Select key={participant.id} value={participant.presence} onValueChange={handlePresenceChange}>
                <SelectTrigger
                  aria-label={`Alterar status de ${participant.displayName}`}
                  title="Clique para alterar seu status"
                  className="h-auto w-full justify-start gap-3 rounded-xl border-transparent bg-slate-900/70 p-3 text-left hover:border-slate-700 hover:bg-slate-900 focus:ring-blue-500/40"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-xs font-semibold tracking-wide text-white"
                    style={{ backgroundColor: `hsl(${avatarHue} 42% 36%)` }}
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">{participant.displayName}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${presenceColor}`} />
                      {presenceLabel}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent side="top" align="start" className="w-[240px]">
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="away">Ausente</SelectItem>
                  <SelectItem value="busy">Ocupado</SelectItem>
                </SelectContent>
              </Select>
            );
          })}
          </div>
        </div>
      </aside>

      <div className="relative mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:min-h-0 lg:px-6 lg:py-5">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800/80 pb-4 [-webkit-app-region:drag]">
          <div>
            <h2 className="text-base font-semibold">Sala de transmissão</h2>
            <p className="mt-1 text-xs text-slate-500">{isHost ? 'Compartilhe sua tela com a sala' : 'Acompanhe a transmissão'}</p>
          </div>
          <div className="shrink-0 [-webkit-app-region:no-drag]">
            {isHost ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isLeaving}
                    className="h-8 gap-2 px-2.5 text-red-300 hover:bg-red-400/10 hover:text-red-200"
                  >
                    <LogOut className="h-4 w-4" />
                    {isLeaving ? 'Encerrando…' : 'Encerrar sala'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[440px] overflow-hidden p-0">
                  <div className="flex gap-4 p-5 sm:p-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-300">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <AlertDialogTitle className="text-base font-semibold tracking-tight text-slate-100">
                        Encerrar esta sala?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="mt-2 text-sm leading-6 text-slate-400">
                        Todos os participantes serão desconectados e o convite deixará de funcionar. Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-950/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <AlertDialogCancel className="w-full sm:w-auto">Manter sala</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLeave} className="w-full sm:w-auto">
                      <LogOut className="h-4 w-4" />Encerrar sala
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isLeaving}
                onClick={handleLeave}
                className="h-8 gap-2 px-2.5 text-slate-400 hover:bg-red-400/10 hover:text-red-200"
              >
                <LogOut className="h-4 w-4" />
                {isLeaving ? 'Saindo…' : 'Sair da sala'}
              </Button>
            )}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 py-4 lg:min-h-0 lg:py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
            <section className="flex min-h-[340px] flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-black/10 sm:min-h-[420px] sm:p-6 lg:min-h-0">
              {presentationStream && isReceivingVideo ? (
                <>
                  <div className="mb-4 flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      {isHost ? 'Sua tela está sendo compartilhada' : `${host?.displayName ?? 'Host'} está compartilhando`}
                    </div>
                    {isHost && (
                      <Button type="button" variant="secondary" size="sm" onClick={onStopCapture}>
                        Parar compartilhamento
                      </Button>
                    )}
                  </div>
                  <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-black">
                    <StreamVideo stream={presentationStream} muted={isHost} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid h-16 w-16 place-items-center rounded-2xl border border-blue-400/15 bg-blue-500/10 text-blue-300">
                    <ScreenIcon className="h-7 w-7" />
                  </div>
                  <p className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Sala pronta</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {isHost ? 'Compartilhe sua tela' : 'Aguardando transmissão'}
                  </h2>
                  <p className="mt-3 max-w-md text-center text-sm leading-6 text-slate-400">
                    {isHost
                      ? 'Escolha um monitor inteiro ou uma janela específica para compartilhar com a sala.'
                      : 'O vídeo da tela compartilhada aparecerá aqui quando o host iniciar.'}
                  </p>
                  {isHost && (
                    <Button type="button" size="lg" onClick={openSourcePicker} className="mt-7 bg-blue-600 text-white hover:bg-blue-500">
                      <ScreenIcon className="mr-2 h-4 w-4" />
                      Compartilhar tela
                    </Button>
                  )}
                </>
              )}

              {captureError && isHost && (
                <p role="alert" className="mt-4 inline-flex w-fit max-w-full items-start gap-2 self-start break-words rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {captureError}
                </p>
              )}
            </section>
          </div>

        </div>
      </div>

      {isSourcePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-dialog-title"
            className="flex max-h-[min(820px,94vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0f172a] text-slate-100 shadow-[0_32px_100px_rgba(0,0,0,0.65)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-800/80 px-5 py-5 sm:px-7">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
                  <ScreenIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="capture-dialog-title" className="text-base font-semibold tracking-tight sm:text-lg">Escolha o que compartilhar</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-400">
                    Selecione uma tela ou janela para transmitir à sala.
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={closeSourcePicker} className="h-8 w-8 shrink-0 text-slate-400 hover:text-slate-100">
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-3 sm:px-7">
              <div role="group" aria-label="Tipo de origem" className="inline-flex rounded-lg border border-slate-700/70 bg-slate-950/70 p-1">
                {(['screen', 'window'] as const).map((kind) => {
                  const isScreen = kind === 'screen';
                  const isActive = sourceKind === kind;
                  const SourceIcon = isScreen ? Monitor : AppWindow;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setSourceKind(kind);
                        setSelectedSourceId(null);
                        void onPrepareSource(null, includeSystemAudio);
                      }}
                      aria-pressed={isActive}
                      className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-slate-100 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <SourceIcon className="h-4 w-4" />
                      {isScreen ? 'Monitores' : 'Janelas'}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-slate-500">
                  {filteredSources.length} {sourceKind === 'screen'
                    ? filteredSources.length === 1 ? 'monitor' : 'monitores'
                    : filteredSources.length === 1 ? 'janela' : 'janelas'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isLoadingSources}
                  onClick={() => void onLoadSources()}
                  className="h-9 gap-2 px-3 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSources ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {captureError && (
                <p role="alert" className="mb-4 flex w-fit max-w-full items-start gap-2.5 break-words rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3.5 py-3 text-sm leading-5 text-red-200">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {captureError}
                </p>
              )}
              {isLoadingSources && filteredSources.length === 0 && (
                <div role="status" className="flex min-h-64 flex-col items-center justify-center text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-slate-700 bg-slate-800/70 text-blue-300">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  </span>
                  <p className="mt-4 text-sm font-medium text-slate-200">Buscando {sourceKind === 'screen' ? 'monitores' : 'janelas'}…</p>
                  <p className="mt-1 text-xs text-slate-500">Isso pode levar alguns segundos.</p>
                </div>
              )}
              {!isLoadingSources && filteredSources.length === 0 && (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/30 px-6 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-slate-700 bg-slate-800/70 text-slate-400">
                    {sourceKind === 'screen' ? <Monitor className="h-5 w-5" /> : <AppWindow className="h-5 w-5" />}
                  </span>
                  <p className="mt-4 text-sm font-medium text-slate-200">Nenhuma {sourceKind === 'screen' ? 'tela' : 'janela'} encontrada</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    Atualize a lista ou escolha outra categoria para continuar.
                  </p>
                </div>
              )}
              {filteredSources.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      disabled={isPreparingSource}
                      onClick={() => void handleSelectSource(source.id)}
                      aria-pressed={selectedSourceId === source.id}
                      className={`group overflow-hidden rounded-xl border bg-slate-950/50 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-wait disabled:opacity-60 ${
                        selectedSourceId === source.id
                          ? 'border-blue-400/80 ring-2 ring-blue-400/25'
                          : 'border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      <span className="relative block overflow-hidden bg-slate-950">
                        <img
                          src={source.thumbnailDataUrl}
                          alt=""
                          className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        {selectedSourceId === source.id && (
                          <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-blue-500 text-white shadow-lg">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 items-center justify-between gap-3 px-3.5 py-3">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-200">{source.name}</span>
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          {sourceKind === 'screen' ? 'Tela' : 'Janela'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {supportsSystemAudio && (
                <label className="mt-5 flex cursor-pointer items-center gap-3.5 rounded-xl border border-slate-700/80 bg-slate-950/40 p-3.5 transition-colors hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={includeSystemAudio}
                    disabled={isPreparingSource || isStartingCapture}
                    onChange={(event) => {
                      void onPrepareSource(selectedSourceId, event.currentTarget.checked);
                    }}
                    className="h-4 w-4 shrink-0 accent-blue-500"
                  />
                  <Volume2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-200">Incluir áudio do sistema</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                      Captura a saída geral do Windows — inclusive áudio de chamadas e outros aplicativos.
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-full border border-slate-700 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-500 sm:inline">
                    Opcional
                  </span>
                </label>
              )}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-slate-800/80 bg-slate-950/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="self-center text-xs text-slate-500">Qualidade inicial de transmissão: até 720p · 30 FPS</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeSourcePicker}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={
                    !selectedSourceId ||
                    preparedSourceId !== selectedSourceId ||
                    isPreparingSource ||
                    isStartingCapture
                  }
                  onClick={() => void handleStartCapture()}
                  className="gap-2 bg-blue-600 px-4 text-white hover:bg-blue-500"
                >
                  {!isPreparingSource && !isStartingCapture && <ScreenIcon className="h-4 w-4" />}
                  {isPreparingSource ? 'Preparando…' : isStartingCapture ? 'Iniciando…' : 'Compartilhar'}
                </Button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {toastMessage && (
        <div
          role={toastTone === 'error' ? 'alert' : 'status'}
          aria-live={toastTone === 'error' ? 'assertive' : 'polite'}
          className={`fixed right-4 top-4 z-[90] flex w-fit max-w-[min(24rem,calc(100vw-2rem))] items-start gap-2.5 break-words rounded-xl border px-4 py-3 text-sm shadow-2xl sm:right-6 sm:top-6 ${
            toastTone === 'error'
              ? 'border-red-400/25 bg-slate-900 text-red-100 shadow-red-950/20'
              : 'border-slate-700 bg-slate-900 text-slate-100'
          }`}
        >
          {toastTone === 'error'
            ? <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            : <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
          <span className="min-w-0">{toastMessage}</span>
        </div>
      )}
    </main>
  );
}

function RemoveParticipantIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M4 6h12M8 6V4h4v2m2 0-.7 10H6.7L6 6m2.5 3v4m3-4v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}
