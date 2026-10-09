import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  AppWindow,
  Check,
  CircleAlert,
  Copy,
  Crown,
  HelpCircle,
  Loader2,
  LogOut,
  Monitor,
  Radio,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { SettingsDialog } from '../components/settings-dialog';
import { SourceThumbnail } from '../components/source-thumbnail';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { LoadingOverlay } from '../components/ui/loading-overlay';
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
  onSetIncludeSystemAudio?: (include: boolean) => void;
  onStartCapture: () => Promise<boolean>;
  onStopCapture: () => void;
  onToggleSystemAudio: (enabled: boolean) => void;
  onLeaveRequested: () => void;
  onLeave: () => void;
  onOpenWelcome?: () => void;
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

const DEFAULT_SIDEBAR_WIDTH = 330;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 500;
const SIDEBAR_WIDTH_STORAGE_KEY = 'topcast:sidebar-width';

function getSavedSidebarWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH;
  const saved = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  if (saved) {
    const parsed = Number.parseInt(saved, 10);
    if (!Number.isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
      return parsed;
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
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
  onSetIncludeSystemAudio,
  onStartCapture,
  onStopCapture,
  onToggleSystemAudio,
  onLeaveRequested,
  onLeave,
  onOpenWelcome,
}: RoomPageProps) {
  const [toastMessage, setToastMessage] = useState('');
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');
  const [isCopied, setIsCopied] = useState(false);
  const [participantActionError, setParticipantActionError] = useState('');
  const [participantToKick, setParticipantToKick] = useState<{ id: string; displayName: string } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const toastTimerRef = useRef<number | null>(null);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [isStartingLocally, setIsStartingLocally] = useState(false);
  const [sourceKind, setSourceKind] = useState<CaptureSource['kind']>('screen');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(sidebarWidth);

  function clampSidebarWidth(width: number): number {
    const maxAllowed = Math.min(
      MAX_SIDEBAR_WIDTH,
      typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.45) : MAX_SIDEBAR_WIDTH,
    );
    return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), Math.max(MIN_SIDEBAR_WIDTH, maxAllowed));
  }

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    isResizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = sidebarWidth;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isResizingRef.current) return;
    const deltaX = event.clientX - startXRef.current;
    const nextWidth = clampSidebarWidth(startWidthRef.current + deltaX);
    setSidebarWidth(nextWidth);
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    setIsResizing(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    const deltaX = event.clientX - startXRef.current;
    const finalWidth = clampSidebarWidth(startWidthRef.current + deltaX);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(finalWidth));
    } catch {
      // ignore
    }
  }

  function handleResetSidebarWidth() {
    const defaultWidth = clampSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    setSidebarWidth(defaultWidth);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(defaultWidth));
    } catch {
      // ignore
    }
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let delta = 0;
    if (event.key === 'ArrowRight') delta = event.shiftKey ? 30 : 10;
    else if (event.key === 'ArrowLeft') delta = event.shiftKey ? -30 : -10;
    else if (event.key === 'Home') delta = MIN_SIDEBAR_WIDTH - sidebarWidth;
    else if (event.key === 'End') delta = MAX_SIDEBAR_WIDTH - sidebarWidth;
    else if (event.key === 'Enter' || event.key === ' ') {
      handleResetSidebarWidth();
      return;
    } else return;

    event.preventDefault();
    const nextWidth = clampSidebarWidth(sidebarWidth + delta);
    setSidebarWidth(nextWidth);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    function handleWindowResize() {
      setSidebarWidth((prev) => clampSidebarWidth(prev));
    }
    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);
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
    if (window.topCast?.copyToClipboard) {
      await window.topCast.copyToClipboard(room.inviteCode);
    } else if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(room.inviteCode);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = room.inviteCode;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (!success) throw new Error('Falha ao copiar');
    }

    setIsCopied(true);
    setToastTone('success');
    setToastMessage('Código copiado para a área de transferência!');
  } catch (error) {
    duration = 4_500;
    setIsCopied(false);
    setToastTone('error');
    setToastMessage('Não foi possível copiar o código.');
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

  function confirmKick(participantId: string) {
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
    void onPrepareSource(null, includeSystemAudio);
    setIsSourcePickerOpen(true);
    void onLoadSources();
  }

  async function handleSelectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    if (!await onPrepareSource(sourceId, includeSystemAudio)) {
      setSelectedSourceId(null);
    }
  }

  function handleToggleIncludeAudio(checked: boolean) {
    if (onSetIncludeSystemAudio) {
      onSetIncludeSystemAudio(checked);
    } else {
      void onPrepareSource(selectedSourceId, checked);
    }
  }

  function closeSourcePicker() {
    setSelectedSourceId(null);
    void onPrepareSource(null, includeSystemAudio);
    setIsSourcePickerOpen(false);
  }

  async function handleStartCapture() {
    if (!selectedSourceId || preparedSourceId !== selectedSourceId || isStartingCapture || isStartingLocally) {
      return;
    }
    setIsStartingLocally(true);
    try {
      const started = await onStartCapture();
      if (started) {
        setIsSourcePickerOpen(false);
      }
    } finally {
      setIsStartingLocally(false);
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
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.1),transparent_48%)]" />

      <aside
        style={{
          ['--sidebar-width' as string]: `${sidebarWidth}px`,
        }}
        className={`relative z-10 flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-950/70 p-4 sm:p-5 lg:h-screen lg:min-h-0 lg:w-[var(--sidebar-width)] lg:border-b-0 lg:border-r lg:px-3.5 lg:py-4 ${
          isResizing ? 'transition-none select-none' : 'transition-[width] duration-150 ease-out'
        }`}
      >
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
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Convite</h2>
            <span className="text-[11px] font-medium text-slate-400">Expira em {formatRoomTimeRemaining(room.expiresAt, now)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-950/60 p-1.5 pl-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-widest text-blue-200">{room.inviteCode}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleCopyCode()}
                  aria-label={isCopied ? 'Código copiado' : 'Copiar código do convite'}
                  className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCopied ? 'Copiado!' : 'Copiar código de convite'}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">Validade: {new Date(room.expiresAt).toLocaleString()}</p>
        </section>

        <section aria-labelledby="participants-heading" className="mt-5 flex min-h-24 flex-1 flex-col lg:min-h-0">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 id="participants-heading" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Participantes</h2>
            <span className="text-[12px] tabular-nums text-slate-500">{room.participants.length}/{room.maxParticipants}</span>
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
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[12px] font-medium text-amber-300">
                        <Crown className="h-3 w-3" />Host
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded-full border border-blue-400/30 bg-blue-400/15 px-2 py-0.5 text-[12px] font-medium text-blue-200">Você</span>
                    )}
                    {!isSelf && participant.role !== 'host' && (
                      <span className="rounded-full border border-slate-600/70 bg-slate-700/40 px-2 py-0.5 text-[12px] font-medium text-slate-400">Convidado</span>
                    )}
                  </div>
                  {isHost && !isSelf && participant.role !== 'host' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${participant.displayName}`}
                          onClick={() => setParticipantToKick({ id: participant.id, displayName: participant.displayName })}
                          className="h-7 w-7 shrink-0 text-slate-500 hover:bg-red-400/10 hover:text-red-200"
                        >
                          <RemoveParticipantIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Remover participante
                      </TooltipContent>
                    </Tooltip>
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

        <div className="mt-4 border-t border-slate-800/80 pt-3 lg:mt-3">
          <section aria-label="Status da conexão e transmissão" className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 shadow-sm backdrop-blur-sm">
            {/* Header com Sinalização e Badge P2P */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                  isRoomConnected
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300 animate-pulse'
                }`}>
                  <Radio className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-200">
                    {isRoomConnected ? 'Sinalização conectada' : signalingStatusLabels[signalingStatus]}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {isRoomConnected
                      ? rtcConnectedCount > 0
                        ? `${rtcConnectedCount} ${rtcConnectedCount === 1 ? 'conexão P2P ativa' : 'conexões P2P ativas'}`
                        : 'Canal WebSocket pronto'
                      : 'Tentando reconectar…'}
                  </span>
                </div>
              </div>

              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
                isRoomConnected
                  ? rtcConnectedCount > 0
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'border-blue-500/30 bg-blue-500/15 text-blue-300'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
              }`}>
                <span className="relative flex h-1.5 w-1.5">
                  {isRoomConnected && rtcConnectedCount > 0 && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    isRoomConnected
                      ? rtcConnectedCount > 0 ? 'bg-emerald-400' : 'bg-blue-400'
                      : 'bg-amber-400'
                  }`} />
                </span>
                {isRoomConnected
                  ? rtcConnectedCount > 0 ? 'RTC OK' : 'Online'
                  : 'Offline'}
              </span>
            </div>

            {/* Controle de Áudio da Transmissão */}
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-slate-400 ${
                  hasSystemAudio && systemAudioEnabled
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                    : 'border-slate-800 bg-slate-950 text-slate-500'
                }`}>
                  {hasSystemAudio && systemAudioEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-slate-300">
                    Áudio da tela
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {!hasSystemAudio
                      ? 'Nenhum som transmitido'
                      : systemAudioEnabled
                      ? 'Transmitindo som'
                      : 'Áudio mutado'}
                  </span>
                </div>
              </div>

              {isHost && hasSystemAudio && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={systemAudioEnabled ? 'Desativar áudio da transmissão' : 'Ativar áudio da transmissão'}
                      onClick={() => onToggleSystemAudio(!systemAudioEnabled)}
                      className={`h-7 px-2 text-[12px] font-medium gap-1.5 transition-colors ${
                        systemAudioEnabled
                          ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                          : 'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                      }`}
                    >
                      {systemAudioEnabled ? (
                        <>
                          <VolumeX className="h-3 w-3" />
                          Mutar
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3" />
                          Ativar
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {systemAudioEnabled ? 'Mutar o som transmitido' : 'Transmitir o som da tela'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {!supportsSystemAudio && (
              <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">
                Áudio do sistema indisponível nesta plataforma.
              </p>
            )}
          </section>

          <div className="mt-3">
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SelectTrigger
                      aria-label={`Alterar status de ${participant.displayName}`}
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
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Clique para alterar seu status
                  </TooltipContent>
                </Tooltip>
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

        {/* Resize Handle (apenas em telas grandes desktop lg+) */}
        <Tooltip open={isResizing ? false : undefined}>
          <TooltipTrigger asChild>
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Redimensionar barra lateral"
              aria-valuenow={sidebarWidth}
              aria-valuemin={MIN_SIDEBAR_WIDTH}
              aria-valuemax={clampSidebarWidth(MAX_SIDEBAR_WIDTH)}
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
              onDoubleClick={handleResetSidebarWidth}
              onKeyDown={handleResizeKeyDown}
              className="group absolute -right-1.5 top-0 bottom-0 z-30 hidden w-3 cursor-col-resize select-none touch-none lg:block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <div
                className={`mx-auto h-full w-[2px] transition-colors duration-150 ${
                  isResizing
                    ? 'bg-blue-500 shadow-[0_0_10px_hsl(var(--primary)/0.9)]'
                    : 'bg-transparent group-hover:bg-blue-400/70 group-focus-visible:bg-blue-400'
                }`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            Arraste para redimensionar (clique duplo para redefinir)
          </TooltipContent>
        </Tooltip>
      </aside>

      <div className="relative mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:min-h-0 lg:px-6 lg:py-5">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800/80 pb-4 [-webkit-app-region:drag]">
          <div>
            <h2 className="text-base font-semibold">Sala de transmissão</h2>
            <p className="mt-1 text-xs text-slate-500">{isHost ? 'Compartilhe sua tela com a sala' : 'Acompanhe a transmissão'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 [-webkit-app-region:no-drag]">
            {onOpenWelcome && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Abrir guia de boas-vindas"
                    onClick={onOpenWelcome}
                    className="h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Guia de Boas-Vindas</TooltipContent>
              </Tooltip>
            )}
            <SettingsDialog />
            {isHost ? (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent>
                    Encerrar sala para todos os participantes
                  </TooltipContent>
                </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  Sair desta sala de transmissão
                </TooltipContent>
              </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="secondary" size="sm" onClick={onStopCapture}>
                            Parar compartilhamento
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Interromper transmissão da sua tela
                        </TooltipContent>
                      </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" size="lg" onClick={openSourcePicker} className="mt-7 bg-blue-600 text-white hover:bg-blue-500">
                          <ScreenIcon className="mr-2 h-4 w-4" />
                          Compartilhar tela
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Selecionar tela ou janela para transmitir
                      </TooltipContent>
                    </Tooltip>
                  )}
                </>
              )}

              {captureError && isHost && !isSourcePickerOpen && (
                <p role="alert" className="mx-auto mt-4 inline-flex w-fit max-w-full items-start gap-2 break-words rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-200">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {captureError}
                </p>
              )}
            </section>
          </div>

        </div>
      </div>

      <Dialog open={isSourcePickerOpen} onOpenChange={(open) => !open && closeSourcePicker()}>
        <DialogContent className="flex max-h-[88vh] w-full max-w-4xl flex-col gap-0 overflow-hidden border-slate-700/80 bg-[#0f172a] p-0 text-slate-100 shadow-[0_32px_100px_rgba(0,0,0,0.65)] sm:max-w-4xl sm:rounded-2xl">
          <DialogHeader className="border-b border-slate-800/80 px-6 py-5 text-left">
            <div className="flex items-center gap-3.5 pr-8">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
                <ScreenIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  Escolha o que compartilhar
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-slate-400 sm:text-sm">
                  Selecione uma tela inteira ou janela de aplicativo para transmitir à sala.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/40 px-6 py-3">
            <div role="tablist" aria-label="Tipo de origem" className="inline-flex rounded-lg border border-slate-700/70 bg-slate-950/70 p-1">
              {(['screen', 'window'] as const).map((kind) => {
                const isScreen = kind === 'screen';
                const isActive = sourceKind === kind;
                const SourceIcon = isScreen ? Monitor : AppWindow;
                return (
                  <button
                    key={kind}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setSourceKind(kind);
                      setSelectedSourceId(null);
                      void onPrepareSource(null, includeSystemAudio);
                    }}
                    className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <SourceIcon className="h-4 w-4" />
                    {isScreen ? 'Telas' : 'Janelas'}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-slate-500">
                {filteredSources.length} {sourceKind === 'screen'
                  ? filteredSources.length === 1 ? 'tela disponível' : 'telas disponíveis'
                  : filteredSources.length === 1 ? 'janela disponível' : 'janelas disponíveis'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>
                  Atualizar lista de telas e janelas
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                <p className="mt-4 text-sm font-medium text-slate-200">Buscando {sourceKind === 'screen' ? 'telas' : 'janelas'}…</p>
                <p className="mt-1 text-xs text-slate-500">Identificando janelas e monitores ativos no sistema.</p>
              </div>
            )}

            {!isLoadingSources && filteredSources.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/30 px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-slate-700 bg-slate-800/70 text-slate-400">
                  {sourceKind === 'screen' ? <Monitor className="h-5 w-5" /> : <AppWindow className="h-5 w-5" />}
                </span>
                <p className="mt-4 text-sm font-medium text-slate-200">Nenhuma {sourceKind === 'screen' ? 'tela' : 'janela'} encontrada</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                  Certifique-se de que a janela desejada não está minimizada e tente atualizar a lista.
                </p>
              </div>
            )}

            {filteredSources.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSources.map((source) => {
                  const isSelected = selectedSourceId === source.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      disabled={isPreparingSource}
                      onClick={() => void handleSelectSource(source.id)}
                      aria-pressed={isSelected}
                      className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-wait disabled:opacity-60 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/30 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-slate-800/80">
                        <SourceThumbnail source={source} sourceKind={sourceKind} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

                        {isSelected && (
                          <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40 animate-in zoom-in-75">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
                        {source.kind === 'window' ? (
                          source.appIconDataUrl ? (
                            <img
                              src={source.appIconDataUrl}
                              alt=""
                              className="h-5 w-5 shrink-0 rounded object-contain bg-slate-900/80 p-0.5"
                            />
                          ) : (
                            <AppWindow className="h-4 w-4 shrink-0 text-slate-400" />
                          )
                        ) : (
                          <Monitor className="h-4 w-4 shrink-0 text-blue-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200 group-hover:text-white">
                          {source.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {supportsSystemAudio && (
              <label
                htmlFor="include-system-audio"
                className={`mt-5 flex cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 transition-all duration-200 select-none ${
                  includeSystemAudio
                    ? 'border-blue-500/50 bg-blue-950/20 shadow-sm'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40'
                }`}
              >
                <Checkbox
                  id="include-system-audio"
                  checked={includeSystemAudio}
                  disabled={isStartingCapture || isStartingLocally}
                  onCheckedChange={(checked) => handleToggleIncludeAudio(checked === true)}
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-500"
                />
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors ${
                    includeSystemAudio
                      ? 'border-blue-500/30 bg-blue-500/15 text-blue-400'
                      : 'border-slate-800 bg-slate-900/80 text-slate-400'
                  }`}
                >
                  <Volume2 className="h-4 w-4" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-200">
                    {sourceKind === 'window' ? 'Transmitir áudio desta janela' : 'Transmitir áudio do sistema'}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                    {sourceKind === 'window'
                      ? 'Captura isolada do áudio deste aplicativo (WASAPI Loopback) — sem transmitir Discord ou sons de outros programas.'
                      : 'Captura a saída geral de som do Windows — incluindo jogos, chamadas e músicas.'}
                  </span>
                </span>
                <span
                  className={`hidden shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors sm:inline ${
                    includeSystemAudio
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                      : 'border-slate-800 bg-slate-900 text-slate-500'
                  }`}
                >
                  Opcional
                </span>
              </label>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800/80 bg-slate-950/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="self-center text-xs text-slate-500">Qualidade inicial: até 720p · 30 FPS</p>
            <div className="flex justify-end gap-2.5">
              <Button type="button" variant="ghost" onClick={closeSourcePicker}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={
                  !selectedSourceId ||
                  preparedSourceId !== selectedSourceId ||
                  isPreparingSource ||
                  isStartingCapture ||
                  isStartingLocally
                }
                onClick={() => void handleStartCapture()}
                className="min-w-[140px] gap-2 bg-blue-600 px-4 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isStartingCapture || isStartingLocally ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Iniciando…</span>
                  </>
                ) : (
                  <>
                    <ScreenIcon className="h-4 w-4" />
                    <span>Compartilhar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(participantToKick)} onOpenChange={(open) => !open && setParticipantToKick(null)}>
        <AlertDialogContent className="max-w-[420px] overflow-hidden p-0">
          <div className="flex gap-4 p-5 sm:p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <AlertDialogTitle className="text-base font-semibold tracking-tight text-slate-100">
                Remover {participantToKick?.displayName}?
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-sm leading-6 text-slate-400">
                Este participante será desconectado da sala imediatamente.
              </AlertDialogDescription>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-800 bg-slate-950/30 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <AlertDialogCancel onClick={() => setParticipantToKick(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (participantToKick) {
                  confirmKick(participantToKick.id);
                  setParticipantToKick(null);
                }
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {isLeaving && (
        <LoadingOverlay
          title="Saindo da sala…"
          description="Encerrando a transmissão e desconectando..."
        />
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
