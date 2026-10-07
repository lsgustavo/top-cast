import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { formatRoomTimeRemaining, getParticipantAvatarHue, getParticipantInitials } from '../lib/room-ui';
import type { RoomSnapshot } from '../../shared/types/signaling';
import type { CaptureSource } from '../../shared/types/desktop-api';
import type { SignalingStatus } from '../../shared/types/signaling';
import type { SignalingClient } from '../lib/signaling-client';

interface RoomPageProps {
  room: RoomSnapshot;
  socket: SignalingClient;
  selfParticipantId: string | null;
  signalingStatus: SignalingStatus;
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
  isMicrophoneEnabled: boolean;
  isMicrophoneStarting: boolean;
  captureError: string | null;
  microphoneError: string | null;
  onLoadSources: () => Promise<CaptureSource[]>;
  onPrepareSource: (sourceId: string | null, includeSystemAudio?: boolean) => Promise<boolean>;
  onStartCapture: () => Promise<boolean>;
  onStopCapture: () => void;
  onToggleSystemAudio: (enabled: boolean) => void;
  onToggleMicrophone: () => Promise<boolean>;
  onDisableMicrophone: () => void;
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
  isMicrophoneEnabled,
  isMicrophoneStarting,
  captureError,
  microphoneError,
  onLoadSources,
  onPrepareSource,
  onStartCapture,
  onStopCapture,
  onToggleSystemAudio,
  onToggleMicrophone,
  onDisableMicrophone,
  onLeaveRequested,
  onLeave,
}: RoomPageProps) {
  const [copyMessage, setCopyMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
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
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopyMessage('Código copiado.');
      setToastMessage('Código copiado!');
    } catch (error) {
      setCopyMessage(error instanceof Error ? `Não foi possível copiar: ${error.message}` : 'Não foi possível copiar o código.');
      setToastMessage('Não foi possível copiar o código.');
    } finally {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 3_000);
    }
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
    onDisableMicrophone();
    socket.emit('room:leave', () => onLeave());
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0b1020] text-slate-50 lg:h-screen lg:flex-row lg:overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.1),transparent_48%)]" />

      <aside className="relative z-10 flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-950/70 p-4 sm:p-5 lg:h-screen lg:w-[272px] lg:border-b-0 lg:border-r lg:px-4 lg:py-5">
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4 [-webkit-app-region:drag]">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
            <ScreenIcon />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">TopCast</h1>
            <p className="mt-0.5 text-xs text-slate-500">Sala de transmissão</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap">
          <span className="text-xs font-medium text-slate-400">{isHost ? 'Você é o host' : 'Participante'}</span>
          <span
            role="status"
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              signalingStatus === 'connected'
                ? 'border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200'
                : 'border-amber-400/20 bg-amber-400/[0.06] text-amber-200'
            }`}
          >
            {signalingStatusLabels[signalingStatus]}
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {isHost && (
            <section aria-label="Controles de áudio" className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Áudio</h2>
              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  variant={systemAudioEnabled ? 'secondary' : 'outline'}
                  disabled={!hasSystemAudio}
                  aria-pressed={systemAudioEnabled}
                  onClick={() => onToggleSystemAudio(!systemAudioEnabled)}
                  className="h-auto min-h-9 justify-start whitespace-normal border-slate-700 px-2.5 py-2 text-left text-xs leading-4 text-slate-200"
                >
                  {systemAudioEnabled ? 'Áudio da transmissão ligado' : 'Áudio da transmissão desligado'}
                </Button>
                <Button
                  type="button"
                  variant={isMicrophoneEnabled ? 'secondary' : 'outline'}
                  disabled={isMicrophoneStarting}
                  aria-pressed={isMicrophoneEnabled}
                  onClick={() => void onToggleMicrophone()}
                  className="h-auto min-h-9 justify-start whitespace-normal border-slate-700 px-2.5 py-2 text-left text-xs leading-4 text-slate-200"
                >
                  {isMicrophoneStarting
                    ? 'Ativando microfone…'
                    : isMicrophoneEnabled ? 'Microfone ligado' : 'Microfone desligado'}
                </Button>
              </div>
              {microphoneError && (
                <p role="alert" className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-2.5 py-2 text-xs leading-5 text-red-200">
                  {microphoneError}
                </p>
              )}
              {!supportsSystemAudio && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  O áudio do sistema está disponível somente no Windows.
                </p>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Convite</h2>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-mono text-base font-semibold tracking-[0.14em] text-slate-100">{room.inviteCode}</span>
              <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopyCode()} className="h-8 px-2.5 text-xs">
                Copiar
              </Button>
            </div>
            <p aria-live="polite" className="mt-2 min-h-4 text-xs text-slate-400">{copyMessage}</p>
            <p className="mt-1 text-[11px] text-slate-500">Válido até {new Date(room.expiresAt).toLocaleString()}</p>
            <p className="mt-2 inline-flex rounded-full border border-blue-400/15 bg-blue-400/[0.06] px-2 py-1 text-[11px] font-medium text-blue-200">
              {formatRoomTimeRemaining(room.expiresAt, now)}
            </p>
          </section>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={isLeaving}
          onClick={handleLeave}
          className="mt-4 w-full border-slate-700 text-slate-300 hover:border-red-400/30 hover:bg-red-400/[0.06] hover:text-red-200"
        >
          {isLeaving ? 'Saindo…' : isHost ? 'Encerrar sala' : 'Sair da sala'}
        </Button>

        <div className="mt-5 border-t border-slate-800 pt-4 lg:mt-auto">
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
      </aside>

      <div className="relative mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:min-h-0 lg:px-6 lg:py-5">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800/80 pb-4 [-webkit-app-region:drag]">
          <div>
            <h2 className="text-base font-semibold">Sala de transmissão</h2>
            <p className="mt-1 text-xs text-slate-500">{isHost ? 'Compartilhe sua tela com a sala' : 'Acompanhe a transmissão'}</p>
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
                <p role="alert" className="mt-4 w-full rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200">
                  {captureError}
                </p>
              )}
            </section>

            <section aria-labelledby="participants-heading" className="shrink-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <h2 id="participants-heading" className="text-sm font-semibold text-slate-100">Participantes</h2>
                  <p className="mt-1 text-xs text-slate-500">Na sala agora</p>
                </div>
                <span className="rounded-md bg-slate-950/70 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-300">
                  {room.participants.length} <span className="text-slate-600">/ {room.maxParticipants}</span>
                </span>
              </div>

              <ul className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {room.participants.map((participant) => {
                  const isSelf = participant.id === selfParticipantId;
                  const initials = getParticipantInitials(participant.displayName);
                  const avatarHue = getParticipantAvatarHue(participant.displayName);

                  return (
                    <li key={participant.id} className="group flex w-full max-w-[220px] min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-slate-950/50">
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-xs font-semibold tracking-wide text-white"
                        style={{ backgroundColor: `hsl(${avatarHue} 42% 36%)` }}
                        role="img"
                        aria-label={`Avatar de ${participant.displayName}`}
                      >
                        {initials}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{participant.displayName}</p>
                      {isHost && !isSelf && participant.role !== 'host' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${participant.displayName}`}
                          title={`Remover ${participant.displayName}`}
                          onClick={() => handleKick(participant.id, participant.displayName)}
                          className="h-8 w-8 shrink-0 text-slate-500 hover:bg-red-400/10 hover:text-red-200 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                        >
                          <RemoveParticipantIcon />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {participantActionError && (
                <p role="alert" className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200">
                  {participantActionError}
                </p>
              )}
            </section>
          </div>

        </div>
      </div>

      {isSourcePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-dialog-title"
            className="flex max-h-[min(760px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
          >
            <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4 sm:px-6">
              <div>
                <h2 id="capture-dialog-title" className="text-lg font-semibold">Escolha o que compartilhar</h2>
                <p className="mt-1 text-sm text-slate-400">Escolha também se deseja incluir áudio do Windows.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={closeSourcePicker}>
                <span aria-hidden="true" className="text-xl leading-none">×</span>
              </Button>
            </header>

            <div className="flex gap-2 border-b border-slate-800 px-5 py-3 sm:px-6">
              {(['screen', 'window'] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant={sourceKind === kind ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setSourceKind(kind);
                    setSelectedSourceId(null);
                    void onPrepareSource(null, includeSystemAudio);
                  }}
                  aria-pressed={sourceKind === kind}
                  className="text-slate-200"
                >
                  {kind === 'screen' ? 'Monitores' : 'Janelas'}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                disabled={isLoadingSources}
                onClick={() => void onLoadSources()}
                className="ml-auto text-slate-400"
              >
                {isLoadingSources ? 'Atualizando…' : 'Atualizar'}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {isLoadingSources && captureSources.length === 0 && (
                <p role="status" className="py-12 text-center text-sm text-slate-400">Buscando monitores e janelas…</p>
              )}
              {!isLoadingSources && filteredSources.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-400">
                  Nenhuma {sourceKind === 'screen' ? 'tela' : 'janela'} disponível. Atualize a lista ou escolha outra categoria.
                </p>
              )}
              {captureError && (
                <p role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm leading-5 text-red-200">
                  {captureError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredSources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    disabled={isPreparingSource}
                    onClick={() => void handleSelectSource(source.id)}
                    aria-pressed={selectedSourceId === source.id}
                    className={`overflow-hidden rounded-xl border text-left transition ${
                      selectedSourceId === source.id
                        ? 'border-blue-400 ring-2 ring-blue-400/30'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <img src={source.thumbnailDataUrl} alt="" className="aspect-video w-full bg-slate-950 object-cover" />
                    <span className="block truncate px-3 py-2.5 text-sm text-slate-200">{source.name}</span>
                  </button>
                ))}
              </div>
              {supportsSystemAudio && (
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3.5">
                  <input
                    type="checkbox"
                    checked={includeSystemAudio}
                    disabled={isPreparingSource || isStartingCapture}
                    onChange={(event) => {
                      void onPrepareSource(selectedSourceId, event.currentTarget.checked);
                    }}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-200">Incluir áudio do sistema</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      Captura a saída geral do Windows — inclusive áudio de chamadas e outros aplicativos.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-800 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
              <p className="self-center text-xs text-slate-500">Qualidade inicial: até 720p · 30 FPS</p>
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
                  className="bg-blue-600 text-white hover:bg-blue-500"
                >
                  {isPreparingSource ? 'Preparando…' : isStartingCapture ? 'Iniciando…' : 'Compartilhar'}
                </Button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-5 top-5 z-[60] rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-2xl"
        >
          {toastMessage}
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
