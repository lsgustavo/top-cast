import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Gauge,
  HelpCircle,
  Layers,
  Loader2,
  LogOut,
  Maximize,
  Minimize,
  Monitor,
  MonitorUp,
  // Legacy sidebar toggle aliases: PanelLeftClose, PanelLeftOpen
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  StopCircle,
  UserX,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { SettingsDialog } from '../components/settings-dialog';
import { SoundboardDialog } from '../components/soundboard-dialog';
import { TopSoundsDropdown } from '../components/top-sounds-dropdown';
import { SOUNDBOARD_CLIPS, soundboardManager, getSoundboardVolume } from '../lib/soundboard';
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
import { saveLocalAvatarSeed } from '../lib/voxel-avatar';
import { VoxelAvatar } from '../components/voxel-avatar';
import { updateAvatar, updateRoomDisplayName, updateRoomPresenter } from '../lib/room-client';
import { useConnectionPing } from '../lib/use-connection-ping';
import { playMuteSound, playStreamStartSound } from '../lib/presence-sound';
import type { RoomParticipant, RoomSnapshot } from '../../shared/types/signaling';
import type { CaptureSource } from '../../shared/types/desktop-api';
import type { SignalingStatus } from '../../shared/types/signaling';
import type { SignalingClient } from '../lib/signaling-client';
import { getRoomPresenterId, type PeerConnectionStatus } from '../features/streaming/use-room-webrtc';
import {
  STREAM_QUALITY_PRESET_LIST,
  STREAM_QUALITY_PRESETS,
  type StreamQualityPresetId,
} from '../features/streaming/stream-quality';
import {
  formatResolutionBadge,
  useWebRtcStats,
} from '../features/streaming/use-webrtc-stats';

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
  isStreamPaused?: boolean;
  qualityPreset?: StreamQualityPresetId;
  captureError: string | null;
  onLoadSources: () => Promise<CaptureSource[]>;
  onPrepareSource: (sourceId: string | null, includeSystemAudio?: boolean) => Promise<boolean>;
  onSetIncludeSystemAudio?: (include: boolean) => void;
  onSetQualityPreset?: (presetId: StreamQualityPresetId) => void;
  onStartCapture: () => Promise<boolean>;
  onStopCapture: () => void;
  onToggleSystemAudio: (enabled: boolean) => void;
  onSetStreamPaused?: (paused: boolean) => void;
  getPeerConnections?: () => Map<string, RTCPeerConnection>;
  onLeaveRequested: () => void;
  onLeave: () => void;
  onOpenWelcome?: () => void;
}

interface StreamVideoProps {
  stream: MediaStream;
  isHost?: boolean;
  participants?: RoomParticipant[];
  selfParticipantId?: string | null;
  localAvatarSeedOverride?: string | null;
  hasSystemAudio?: boolean;
  systemAudioEnabled?: boolean;
  onToggleSystemAudio?: (enabled: boolean) => void;
  isStreamPaused?: boolean;
  onToggleStreamPause?: () => void;
  isLocalPreviewHidden?: boolean;
  onToggleLocalPreviewHidden?: () => void;
  isViewerDeafened?: boolean;
  onToggleViewerDeafen?: (deafened: boolean) => void;
  qualityPreset?: StreamQualityPresetId;
  onSetQualityPreset?: (presetId: StreamQualityPresetId) => void;
  getPeerConnections?: () => Map<string, RTCPeerConnection>;
}

function StreamVideo({ stream, isHost = false, ...restProps }: StreamVideoProps) {
  const {
    participants = [],
    selfParticipantId = null,
    localAvatarSeedOverride = null,
    hasSystemAudio = false,
    systemAudioEnabled = true,
    onToggleSystemAudio,
    isStreamPaused = false,
    onToggleStreamPause,
    isLocalPreviewHidden = false,
    onToggleLocalPreviewHidden,
    isViewerDeafened = false,
    onToggleViewerDeafen,
    qualityPreset = '1080p60',
    onSetQualityPreset,
    getPeerConnections,
  } = restProps;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(isHost);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVolumeRef = useRef(1);

  const liveStats = useWebRtcStats({
    enabled: showStats,
    isHost,
    stream,
    videoElement: videoRef.current,
    getPeerConnections,
  });

  // Sincroniza stream no elemento de vídeo
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.srcObject = stream;
      if (isHost) {
        videoElement.muted = true;
      } else {
        videoElement.volume = volume;
        videoElement.muted = isMuted;
      }
      videoElement.play().catch(() => {
        // Ignora rejeição de autoplay se necessário
      });
    }
    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [stream, isHost]);

  // Sincroniza estado de mudo externo da sidebar (para convidados)
  useEffect(() => {
    if (!isHost) {
      setIsMuted(isViewerDeafened);
    }
  }, [isViewerDeafened, isHost]);

  // Mantém volume e silenciamento reativamente sincronizados
  useEffect(() => {
    if (videoRef.current) {
      if (isHost) {
        videoRef.current.muted = true;
      } else {
        videoRef.current.volume = volume;
        videoRef.current.muted = isMuted;
      }
    }
    if (!isHost && stream) {
      for (const track of stream.getAudioTracks()) {
        track.enabled = !isMuted && volume > 0;
      }
    }
  }, [volume, isMuted, isHost, stream]);

  // Escuta alterações de Picture-in-Picture no elemento de vídeo
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleEnterPip = () => setIsPip(true);
    const handleLeavePip = () => setIsPip(false);

    videoEl.addEventListener('enterpictureinpicture', handleEnterPip);
    videoEl.addEventListener('leavepictureinpicture', handleLeavePip);

    return () => {
      videoEl.removeEventListener('enterpictureinpicture', handleEnterPip);
      videoEl.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, []);

  const togglePictureInPicture = async () => {
    const videoEl = videoRef.current as (HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
    }) | null;
    const doc = document as Document & {
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
    };
    if (!videoEl) return;

    try {
      if (doc.pictureInPictureElement) {
        if (doc.exitPictureInPicture) {
          await doc.exitPictureInPicture();
        }
        setIsPip(false);
      } else if (typeof videoEl.requestPictureInPicture === 'function') {
        await videoEl.requestPictureInPicture();
        setIsPip(true);
      }
    } catch (err) {
      console.warn('[StreamVideo] Falha ao alternar Picture-in-Picture:', err);
    }
    resetHideTimer();
  };

  // Escuta alterações de tela cheia com suporte cross-browser/Electron
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as unknown as {
        fullscreenElement?: Element | null;
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };
      const active = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement,
      );
      setIsFullscreen(active);
      window.dispatchEvent(new CustomEvent('topcast:fullscreen-change', { detail: { isFullscreen: active } }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.dispatchEvent(new CustomEvent('topcast:fullscreen-change', { detail: { isFullscreen: false } }));
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const container = containerRef.current;
      const doc = document as unknown as {
        fullscreenElement?: Element | null;
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };

      const isCurrentlyFullscreen = Boolean(
        isFullscreen ||
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement,
      );

      if (!isCurrentlyFullscreen) {
        let apiSucceeded = false;
        if (container) {
          const el = container as unknown as {
            requestFullscreen?: () => Promise<void>;
            webkitRequestFullscreen?: () => Promise<void>;
            mozRequestFullScreen?: () => Promise<void>;
            msRequestFullscreen?: () => Promise<void>;
          };

          try {
            if (el.requestFullscreen) {
              await el.requestFullscreen();
              apiSucceeded = true;
            } else if (el.webkitRequestFullscreen) {
              await el.webkitRequestFullscreen();
              apiSucceeded = true;
            } else if (doc.fullscreenElement !== undefined && document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
              apiSucceeded = true;
            } else if (el.mozRequestFullScreen) {
              await el.mozRequestFullScreen();
              apiSucceeded = true;
            } else if (el.msRequestFullscreen) {
              await el.msRequestFullscreen();
              apiSucceeded = true;
            }
          } catch (apiErr) {
            console.warn('[StreamVideo] HTML5 requestFullscreen falhou, aplicando fallback:', apiErr);
          }
        }

        // Sempre sincroniza também a janela nativa do Electron com o modo tela cheia
        if (window.topCast?.isFullScreen && window.topCast?.toggleFullScreen) {
          try {
            const isWindowFs = await window.topCast.isFullScreen();
            if (!isWindowFs) {
              await window.topCast.toggleFullScreen();
            }
          } catch {
            // Ignora se fora do Electron
          }
        }
        setIsFullscreen(true);
        resetHideTimer();
        window.dispatchEvent(new CustomEvent('topcast:fullscreen-change', { detail: { isFullscreen: true } }));
      } else {
        try {
          if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
            if (doc.exitFullscreen) {
              await doc.exitFullscreen();
            } else if (doc.webkitExitFullscreen) {
              await doc.webkitExitFullscreen();
            } else if (doc.mozCancelFullScreen) {
              await doc.mozCancelFullScreen();
            } else if (doc.msExitFullscreen) {
              await doc.msExitFullscreen();
            }
          }
        } catch (exitErr) {
          console.warn('[StreamVideo] HTML5 exitFullscreen falhou:', exitErr);
        }

        if (window.topCast?.isFullScreen && window.topCast?.toggleFullScreen) {
          try {
            const isWindowFs = await window.topCast.isFullScreen();
            if (isWindowFs) {
              await window.topCast.toggleFullScreen();
            }
          } catch {
            // Ignora
          }
        }

        setIsFullscreen(false);
        resetHideTimer();
        window.dispatchEvent(new CustomEvent('topcast:fullscreen-change', { detail: { isFullscreen: false } }));
      }
    } catch (err) {
      console.warn('[StreamVideo] Erro ao alternar tela cheia:', err);
      const next = !isFullscreen;
      setIsFullscreen(next);
      window.dispatchEvent(new CustomEvent('topcast:fullscreen-change', { detail: { isFullscreen: next } }));
    }
  };

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  const handleMouseMove = () => {
    resetHideTimer();
  };

  const handleMouseLeave = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setShowControls(false);
  };

  const toggleMute = () => {
    if (isHost) return;
    if (isMuted || volume === 0) {
      const restore = prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.8;
      setVolume(restore);
      setIsMuted(false);
      onToggleViewerDeafen?.(false);
      playMuteSound(false);
    } else {
      prevVolumeRef.current = volume;
      setIsMuted(true);
      onToggleViewerDeafen?.(true);
      playMuteSound(true);
    }
    resetHideTimer();
  };

  const handleVolumeChange = (newVolume: number) => {
    if (isHost) return;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      onToggleViewerDeafen?.(false);
      playMuteSound(false);
    } else if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
      onToggleViewerDeafen?.(true);
      playMuteSound(true);
    }
    resetHideTimer();
  };

  // Atalhos de teclado: F para tela cheia, P para Picture-in-Picture, Esc para sair, M para mutar (estritamente para quem assiste)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        void togglePictureInPicture();
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        void toggleFullscreen();
      } else if ((e.key === 'm' || e.key === 'M') && !isHost) {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const handleExternalFullscreenRequest = () => {
      void toggleFullscreen();
    };
    window.addEventListener('topcast:request-fullscreen', handleExternalFullscreenRequest);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('topcast:request-fullscreen', handleExternalFullscreenRequest);
    };
  }, [isFullscreen, isPip, isMuted, volume, isHost]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group flex items-center justify-center overflow-hidden bg-black select-none transition-all duration-150 ${
        isFullscreen
          ? 'fixed inset-0 z-[100] h-screen w-screen'
          : 'relative h-full w-full'
      } ${isFullscreen && !showControls ? 'cursor-none' : 'cursor-default'}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost ? true : isMuted}
        onDoubleClick={() => void toggleFullscreen()}
        className={`max-h-full max-w-full h-auto w-auto m-auto bg-black object-contain cursor-pointer ${
          isHost && isLocalPreviewHidden ? 'hidden' : ''
        }`}
      />

      {/* Card de Prévia Local Oculta (Fim do Espelho Infinito) */}
      {isHost && isLocalPreviewHidden && !isStreamPaused && (
        <div
          data-local-preview-hidden-card
          onClick={(e) => e.stopPropagation()}
          className="relative z-20 mx-4 flex max-w-md flex-col items-center justify-center rounded-2xl border border-border/40 bg-slate-950/85 p-6 text-center shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-3.5 grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-sm">
            <EyeOff className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base">
            Prévia local oculta
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Sua tela continua sendo transmitida ao vivo para os participantes. A prévia local foi desativada para evitar o espelho infinito.
          </p>
          {onToggleLocalPreviewHidden && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleLocalPreviewHidden}
              className="mt-4 h-9 gap-2 rounded-xl border border-border/40 bg-slate-900/80 px-4 text-xs font-medium text-slate-200 shadow-sm transition-all hover:bg-slate-800 hover:text-white"
            >
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span>Mostrar prévia</span>
            </Button>
          )}
        </div>
      )}

      {/* Overlay de Transmissão Pausada (Modo Privacidade Rápido) */}
      {isStreamPaused && (
        <div
          data-stream-paused-overlay
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-25 flex flex-col items-center justify-center bg-slate-950/85 p-6 text-center backdrop-blur-xl"
        >
          <div className="mb-3.5 grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-300 shadow-sm">
            <Pause className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base">
            Transmissão pausada
          </h3>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
            {isHost
              ? 'O envio de imagem e som da sua tela está pausado temporariamente. Nenhum conteúdo da sua tela está visível para a sala.'
              : 'O transmissor pausou o compartilhamento de tela temporariamente. A imagem voltará em instantes.'}
          </p>
          {isHost && onToggleStreamPause && (
            <Button
              type="button"
              size="sm"
              onClick={onToggleStreamPause}
              className="mt-4 h-9 gap-2 rounded-xl bg-amber-500 px-4 text-xs font-semibold text-slate-950 shadow-sm transition-all hover:bg-amber-400"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Retomar transmissão</span>
            </Button>
          )}
        </div>
      )}

      {/* HUD de Estatísticas em Tempo Real ("Modo Nerd") */}
      {showStats && (
        <section
          role="region"
          aria-label="Estatísticas da transmissão em tempo real"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            setShowControls(true);
          }}
          className="absolute left-3.5 top-3.5 z-30 w-72 sm:w-80 rounded-2xl bg-slate-950/85 p-3.5 text-xs text-slate-200 shadow-2xl backdrop-blur-xl glass-surface-secondary"
        >
          <div className="flex items-center justify-between border-b border-primary/15 pb-2.5">
            <div className="flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold tracking-tight text-white">
                Estatísticas em Tempo Real
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowStats(false)}
              aria-label="Fechar estatísticas da transmissão"
              className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <dl className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="flex flex-col justify-between rounded-xl bg-slate-900/70 px-2.5 py-2 shadow-sm">
              <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Resolução
              </dt>
              <dd className="mt-1 flex items-center justify-between gap-1.5 whitespace-nowrap font-mono text-xs font-semibold text-white">
                <span className="truncate">
                  {liveStats.width && liveStats.height
                    ? `${liveStats.width}×${liveStats.height}`
                    : '—'}
                </span>
                {liveStats.width && liveStats.height && (
                  <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-primary/15 px-1.5 py-0.5 font-sans text-[9px] font-semibold leading-none tracking-tight text-primary">
                    {formatResolutionBadge(liveStats.width, liveStats.height)}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex flex-col justify-between rounded-xl bg-slate-900/70 px-2.5 py-2 shadow-sm">
              <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Taxa de Quadros
              </dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-xs font-semibold text-emerald-300">
                {liveStats.fps !== null ? `${liveStats.fps} FPS` : '—'}
              </dd>
            </div>

            <div className="flex flex-col justify-between rounded-xl bg-slate-900/70 px-2.5 py-2 shadow-sm">
              <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Bitrate {isHost ? '(Envio)' : '(Recepção)'}
              </dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-xs font-semibold text-blue-300">
                {liveStats.bitrateMbps !== null ? `${liveStats.bitrateMbps} Mbps` : 'Local'}
              </dd>
            </div>

            <div className="flex flex-col justify-between rounded-xl bg-slate-900/70 px-2.5 py-2 shadow-sm">
              <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Codec / Latência
              </dt>
              <dd className="mt-1 truncate whitespace-nowrap font-mono text-xs font-semibold text-slate-100">
                {liveStats.codec ?? 'WebRTC'}
                {liveStats.rttMs !== null ? ` · ${liveStats.rttMs} ms` : ''}
              </dd>
            </div>
          </dl>

          {!isHost && (liveStats.packetLossPercent !== null || liveStats.jitterMs !== null) && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-900/50 px-2.5 py-1.5 text-[11px] text-slate-400">
              <span>
                Perda:{' '}
                <strong className="font-mono text-slate-200">
                  {liveStats.packetLossPercent !== null ? `${liveStats.packetLossPercent}%` : '0.0%'}
                </strong>
              </span>
              {liveStats.jitterMs !== null && (
                <span>
                  Jitter: <strong className="font-mono text-slate-200">{liveStats.jitterMs} ms</strong>
                </span>
              )}
            </div>
          )}

          {isHost && liveStats.qualityLimitationReason && liveStats.qualityLimitationReason !== 'none' && (
            <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
              Limitação detectada: <strong className="uppercase">{liveStats.qualityLimitationReason}</strong>
            </div>
          )}
        </section>
      )}

      {/* Strip/Grid de miniaturas e avatares dos participantes no Modo Imersivo (Estilo Discord) */}
      {isFullscreen && participants.length > 0 && (
        <aside
          aria-label="Participantes na transmissão"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            setShowControls(true);
          }}
          className={`absolute right-4 top-4 bottom-20 z-30 flex flex-col items-end justify-start gap-2.5 overflow-y-auto py-1 pr-1 transition-all duration-200 ${
            showControls ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-60 hover:opacity-100 pointer-events-auto'
          }`}
        >
          {participants.map((participant) => {
            const isSelf = participant.id === selfParticipantId;
            const presenceColor =
              participant.presence === 'available'
                ? 'bg-emerald-400'
                : participant.presence === 'away'
                ? 'bg-amber-400'
                : 'bg-red-400';
            const isParticipantHost = participant.role === 'host';

            return (
              <div
                key={participant.id}
                data-immersive-participant-tile
                className="group/tile relative flex w-36 sm:w-44 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-950/75 p-3 shadow-xl backdrop-blur-xl transition-all duration-150 hover:bg-slate-900/90"
              >
                <div className="relative mb-2">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-slate-900 shadow-md">
                    <VoxelAvatar
                      displayName={participant.displayName}
                      seed={
                        isSelf && localAvatarSeedOverride
                          ? localAvatarSeedOverride
                          : participant.avatarSeed
                      }
                    />
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${presenceColor}`}
                  />
                </div>

                <div className="flex w-full items-center justify-center gap-1 px-1">
                  {isParticipantHost && (
                    <Crown className="h-3 w-3 shrink-0 text-amber-400" />
                  )}
                  <span className="truncate text-xs font-medium text-slate-100">
                    {participant.displayName}
                  </span>
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {/* Barra de controles flutuante sobre o vídeo com efeito glass */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 py-3 sm:px-5 sm:py-4 transition-opacity duration-200 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setShowControls(true);
        }}
      >
        {/* Esquerda: Badge Ao Vivo (clicável para abrir Estatísticas) e Controle de Volume / Mudo */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  setShowStats((prev) => !prev);
                  resetHideTimer();
                }}
                aria-pressed={showStats}
                aria-label="Alternar estatísticas da transmissão em tempo real"
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm backdrop-blur-md transition-colors ${
                  isStreamPaused
                    ? 'border-amber-500/35 bg-amber-500/15 text-amber-300 hover:border-amber-400/50 hover:bg-amber-500/25'
                    : 'border-red-500/25 bg-red-500/15 text-red-300 hover:border-red-400/40 hover:bg-red-500/25'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {!isStreamPaused && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${isStreamPaused ? 'bg-amber-400' : 'bg-red-500'}`} />
                </span>
                <span>{isStreamPaused ? 'PAUSADO' : 'AO VIVO'}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Clique para {showStats ? 'ocultar' : 'ver'} estatísticas da transmissão
            </TooltipContent>
          </Tooltip>

          {/* Botão de Pausar/Retomar transmissão para o Host no overlay flutuante */}
          {isHost && onToggleStreamPause && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onToggleStreamPause();
                resetHideTimer();
              }}
              aria-pressed={isStreamPaused}
              aria-label={isStreamPaused ? 'Retomar transmissão' : 'Pausar transmissão'}
              className={`h-8 px-2.5 text-xs font-medium gap-1.5 rounded-xl border backdrop-blur-md transition-all ${
                isStreamPaused
                  ? 'border-amber-500/35 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                  : 'border-border/40 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {isStreamPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 text-amber-300" />
                  <span>Retomar</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5 text-slate-300" />
                  <span>Pausar</span>
                </>
              )}
            </Button>
          )}

          {/* Botão de Mutar transmissão para o Host no overlay flutuante */}
          {isHost && hasSystemAudio && onToggleSystemAudio && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const nextEnabled = !systemAudioEnabled;
                playMuteSound(!nextEnabled);
                onToggleSystemAudio(nextEnabled);
                resetHideTimer();
              }}
              className={`h-8 px-2.5 text-xs font-medium gap-1.5 rounded-xl border backdrop-blur-md transition-all ${
                systemAudioEnabled
                  ? 'border-border/40 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white'
                  : 'border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25'
              }`}
              aria-label={systemAudioEnabled ? 'Mutar áudio da transmissão' : 'Ativar áudio da transmissão'}
            >
              {systemAudioEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Mutar</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-red-400" />
                  <span>Mutado</span>
                </>
              )}
            </Button>
          )}

          {/* Slider de volume renderizado estritamente para o convidado */}
          {!isHost && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-slate-900/80 px-3 py-1.5 backdrop-blur-md shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-7 w-7 rounded-lg border border-border/40 bg-slate-900/60 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                title={isMuted ? 'Ativar som (M)' : 'Silenciar (M)'}
                aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-3.5 w-3.5 text-red-400" />
                ) : volume > 0.5 ? (
                  <Volume2 className="h-3.5 w-3.5 text-slate-200" />
                ) : (
                  <Volume1 className="h-3.5 w-3.5 text-slate-200" />
                )}
              </Button>

              <Slider
                value={[isMuted ? 0 : volume * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([val]) => handleVolumeChange(val / 100)}
                className="w-16 cursor-pointer sm:w-24"
                aria-label="Controle de volume da transmissão"
              />

              <span className="w-8 text-right font-mono text-[11px] font-medium text-slate-300 select-none tabular-nums">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Direita: Ocultar Prévia (Host), Seletor de Qualidade (Host), Estatísticas, Top Sounds, Picture-in-Picture e Tela Cheia */}
        <div className="flex items-center gap-2">
          {/* Botão de Ocultar/Mostrar Prévia Local para o Host */}
          {isHost && onToggleLocalPreviewHidden && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onToggleLocalPreviewHidden();
                    resetHideTimer();
                  }}
                  aria-pressed={isLocalPreviewHidden}
                  aria-label={isLocalPreviewHidden ? 'Mostrar prévia local' : 'Ocultar prévia local'}
                  className={`h-9 w-9 rounded-xl border backdrop-blur-md shadow-sm transition-colors ${
                    isLocalPreviewHidden
                      ? 'border-primary/50 bg-primary/20 text-primary'
                      : 'border-border/40 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {isLocalPreviewHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isLocalPreviewHidden ? 'Mostrar prévia local' : 'Ocultar prévia local'}
              </TooltipContent>
            </Tooltip>
          )}
          {/* Seletor de Qualidade em Tempo Real para o Host */}
          {isHost && onSetQualityPreset && (
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQualityMenuOpen((prev) => !prev);
                      resetHideTimer();
                    }}
                    aria-expanded={qualityMenuOpen}
                    aria-label="Selecionar qualidade da transmissão"
                    className="h-9 gap-1.5 rounded-xl border border-border/40 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 backdrop-blur-md shadow-sm transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                    <span>{STREAM_QUALITY_PRESETS[qualityPreset].shortLabel}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Qualidade da transmissão</TooltipContent>
              </Tooltip>

              {qualityMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Presets de qualidade da transmissão"
                  className="absolute bottom-full right-0 z-50 mb-2 w-56 overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Qualidade da Transmissão
                  </div>
                  {STREAM_QUALITY_PRESET_LIST.map((preset) => {
                    const isSelected = qualityPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onSetQualityPreset(preset.id);
                          setQualityMenuOpen(false);
                          resetHideTimer();
                        }}
                        className={`flex w-full flex-col items-start rounded-xl px-2.5 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-primary/15 text-white'
                            : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold">
                            <span>{preset.label}</span>
                            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                              {preset.badge}
                            </span>
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <span className="mt-0.5 text-[10px] text-slate-400">
                          {preset.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Botão de Estatísticas em Tempo Real ("Modo Nerd") */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowStats((prev) => !prev);
                  resetHideTimer();
                }}
                aria-pressed={showStats}
                aria-label="Estatísticas da transmissão"
                className={`h-9 w-9 rounded-xl border backdrop-blur-md shadow-sm transition-colors ${
                  showStats
                    ? 'border-primary/50 bg-primary/20 text-primary'
                    : 'border-border/40 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Gauge className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {showStats ? 'Ocultar estatísticas' : 'Estatísticas em tempo real'}
            </TooltipContent>
          </Tooltip>

          {/* Top Sounds Dropdown para usar na transmissão (abre para CIMA e para a ESQUERDA) */}
          <TopSoundsDropdown placement="top-left" triggerSize="default" />

          {/* Botão Picture-in-Picture (PiP) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void togglePictureInPicture()}
                aria-pressed={isPip}
                aria-label={isPip ? 'Sair do Picture-in-Picture' : 'Modo Picture-in-Picture'}
                className={`h-9 w-9 rounded-xl border backdrop-blur-md shadow-sm transition-colors ${
                  isPip
                    ? 'border-primary/50 bg-primary/20 text-primary'
                    : 'border-border/40 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <PictureInPicture2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isPip ? 'Sair do Picture-in-Picture (P)' : 'Picture-in-Picture (P)'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void toggleFullscreen()}
                className="h-9 w-9 rounded-xl border border-border/40 bg-slate-900/60 text-slate-300 backdrop-blur-md shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100 active:scale-95 focus-visible:ring-primary"
                aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isFullscreen ? 'Sair da tela cheia (F ou Esc)' : 'Tela cheia (F)'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
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
  isStreamPaused: isStreamPausedProp = false,
  qualityPreset = '1080p60',
  captureError,
  onLoadSources,
  onPrepareSource,
  onSetIncludeSystemAudio,
  onSetQualityPreset,
  onStartCapture,
  onStopCapture,
  onToggleSystemAudio,
  onSetStreamPaused,
  getPeerConnections,
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
  const [presenceSelectOpen, setPresenceSelectOpen] = useState(false);
  const presenceContainerRef = useRef<HTMLDivElement | null>(null);
  const [localAvatarSeedOverride, setLocalAvatarSeedOverride] = useState<string | null>(null);
  const [isStartingLocally, setIsStartingLocally] = useState(false);
  const [sourceKind, setSourceKind] = useState<CaptureSource['kind']>('screen');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedSidebarWidth);
  const [isStreamFullscreen, setIsStreamFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLocalPreviewHidden, setIsLocalPreviewHidden] = useState(false);
  const [isStreamPausedInternal, setIsStreamPausedInternal] = useState(false);
  const [isRemoteStreamPaused, setIsRemoteStreamPaused] = useState(false);
  const [isViewerDeafened, setIsViewerDeafened] = useState(false);
  const connectionPing = useConnectionPing(socket, signalingStatus);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(sidebarWidth);
  const resizeRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, []);

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
    const clientX = event.clientX;
    if (resizeRafRef.current !== null) {
      cancelAnimationFrame(resizeRafRef.current);
    }
    resizeRafRef.current = requestAnimationFrame(() => {
      const deltaX = clientX - startXRef.current;
      const nextWidth = clampSidebarWidth(startWidthRef.current + deltaX);
      setSidebarWidth(nextWidth);
      resizeRafRef.current = null;
    });
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!isResizingRef.current) return;
    if (resizeRafRef.current !== null) {
      cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = null;
    }
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
  const activePresenterId = getRoomPresenterId(room);
  const presenter = room.participants.find((participant) => participant.id === activePresenterId) ?? host;
  const isPresenter = Boolean(selfParticipantId && activePresenterId === selfParticipantId);
  const remoteHostStream = presenter ? remoteStreams[presenter.id] ?? null : null;
  const presentationStream = isPresenter ? localStream : remoteHostStream;
  const isStreamPaused = isPresenter
    ? (isStreamPausedProp || isStreamPausedInternal)
    : isRemoteStreamPaused;
  const isReceivingVideo = presentationStream !== null && (
    isPresenter || isRemoteStreamPaused || presentationStream.getVideoTracks().some((track) => (!track.muted || isRemoteStreamPaused) && track.readyState === 'live')
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
    const handleStreamPaused = (payload: { fromParticipantId: string; paused: boolean }) => {
      if (payload.fromParticipantId !== selfParticipantId) {
        setIsRemoteStreamPaused(Boolean(payload.paused));
      }
    };
    socket.on('room:stream-paused', handleStreamPaused);
    return () => {
      socket.off('room:stream-paused', handleStreamPaused);
    };
  }, [socket, selfParticipantId]);

  useEffect(() => {
    if (!presentationStream) {
      setIsRemoteStreamPaused(false);
      setIsStreamPausedInternal(false);
    }
  }, [presentationStream]);

  // Atalho 'T' para alternar Modo Teatro (recolher/expandir sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleStreamPause = () => {
    if (!isPresenter) return;
    const nextPaused = !isStreamPaused;
    setIsStreamPausedInternal(nextPaused);
    onSetStreamPaused?.(nextPaused);
    if (localStream) {
      for (const track of localStream.getVideoTracks()) {
        track.enabled = !nextPaused;
      }
    }
    socket.emit('room:stream-paused', { paused: nextPaused });
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

  // Fecha o dropdown de status ao clicar fora
  useEffect(() => {
    if (!presenceSelectOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        presenceContainerRef.current &&
        !presenceContainerRef.current.contains(event.target as Node)
      ) {
        setPresenceSelectOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [presenceSelectOpen]);

  // Sincroniza estado de tela cheia disparado pelo StreamVideo para eliminar contenção CSS
  useEffect(() => {
    const handleFullscreenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ isFullscreen: boolean }>;
      if (typeof customEvent.detail?.isFullscreen === 'boolean') {
        setIsStreamFullscreen(customEvent.detail.isFullscreen);
      }
    };
    window.addEventListener('topcast:fullscreen-change', handleFullscreenEvent);
    return () => {
      window.removeEventListener('topcast:fullscreen-change', handleFullscreenEvent);
    };
  }, []);

  const wasReceivingVideoRef = useRef(false);

  useEffect(() => {
    if (!presentationStream || !isReceivingVideo) {
      setIsStreamFullscreen(false);
    }
  }, [presentationStream, isReceivingVideo]);

  // Reproduz efeito sonoro estilo Discord "Go Live" ao iniciar (ou encerrar) uma transmissão
  useEffect(() => {
    if (isReceivingVideo && !wasReceivingVideoRef.current) {
      wasReceivingVideoRef.current = true;
      playStreamStartSound('start');
    } else if (!isReceivingVideo && wasReceivingVideoRef.current) {
      wasReceivingVideoRef.current = false;
      playStreamStartSound('stop');
    }
  }, [isReceivingVideo]);

  // Sincronização em tempo real do Top-Sounds (Soundboard) para todos os participantes da sala
  useEffect(() => {
    const unsubPlay = soundboardManager.onClipPlay((clip, volume) => {
      socket.emit('room:soundboard-play', { clipId: clip.id, volume });
    });
    const unsubStop = soundboardManager.onClipStop((clipId) => {
      socket.emit('room:soundboard-stop', { clipId });
    });

    const handleRemotePlay = (payload: { fromParticipantId: string; clipId: string; volume?: number }) => {
      if (payload.fromParticipantId === selfParticipantId) return;
      // Se o espectador silenciou a saída de áudio na sidebar, não reproduz efeitos remotos
      if (!isPresenter && isViewerDeafened) return;
      const clip = SOUNDBOARD_CLIPS.find((c) => c.id === payload.clipId);
      if (clip) {
        const eqVolume = Math.max(0, Math.min(1, (payload.volume ?? 0.8) * getSoundboardVolume()));
        soundboardManager.play(clip, eqVolume, { remote: true });
      }
    };

    const handleRemoteStop = (payload: { fromParticipantId: string; clipId: string }) => {
      if (payload.fromParticipantId === selfParticipantId) return;
      soundboardManager.stop(payload.clipId, { remote: true });
    };

    socket.on('room:soundboard-play', handleRemotePlay);
    socket.on('room:soundboard-stop', handleRemoteStop);

    return () => {
      unsubPlay();
      unsubStop();
      socket.off('room:soundboard-play', handleRemotePlay);
      socket.off('room:soundboard-stop', handleRemoteStop);
    };
  }, [socket, selfParticipantId, isPresenter, isViewerDeafened]);

  const handleToggleSidebarMute = () => {
    if (isPresenter) {
      const nextEnabled = !systemAudioEnabled;
      playMuteSound(!nextEnabled);
      onToggleSystemAudio(nextEnabled);
      if (localStream) {
        for (const track of localStream.getAudioTracks()) {
          track.enabled = nextEnabled;
        }
      }
    } else {
      const nextDeafened = !isViewerDeafened;
      playMuteSound(nextDeafened);
      setIsViewerDeafened(nextDeafened);
      if (remoteHostStream) {
        for (const track of remoteHostStream.getAudioTracks()) {
          track.enabled = !nextDeafened;
        }
      }
      if (nextDeafened) {
        soundboardManager.stopAll({ remote: true });
      }
    }
  };


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
    } catch {
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

  async function handleAvatarSeedChange(newSeed: string) {
    setLocalAvatarSeedOverride(newSeed);
    saveLocalAvatarSeed(newSeed);

    try {
      await updateAvatar(socket, newSeed);
    } catch (err) {
      console.error('Falha ao atualizar avatar:', err);
    }
  }

  async function handleDisplayNameChange(newName: string) {
    const trimmed = newName.trim().slice(0, 32);
    if (!trimmed) return;
    setParticipantActionError('');
    try {
      window.localStorage.setItem('topcast:display-name', trimmed);
    } catch {
      // ignore
    }
    try {
      const result = await updateRoomDisplayName(socket, trimmed);
      if (!result.ok) {
        setParticipantActionError('Não foi possível atualizar seu nome na sala.');
      }
    } catch {
      setParticipantActionError('Não foi possível atualizar seu nome na sala.');
    }
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

  async function handleSetPresenter(targetParticipantId: string, openPickerAfter = false) {
    setParticipantActionError('');
    if (isPresenter && targetParticipantId !== selfParticipantId) {
      onStopCapture();
    }
    const targetParticipant = room.participants.find((p) => p.id === targetParticipantId);
    const result = await updateRoomPresenter(socket, targetParticipantId);
    if (!result.ok) {
      setParticipantActionError(
        result.error === 'NOT_ALLOWED'
          ? 'Você não tem permissão para alterar o transmissor.'
          : 'Não foi possível alterar o transmissor da sala.',
      );
      return;
    }

    setToastTone('success');
    setToastMessage(
      targetParticipantId === selfParticipantId
        ? 'Você assumiu o controle da transmissão!'
        : `Transmissão passada para ${targetParticipant?.displayName ?? 'o participante'}!`,
    );
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
    }, 3_000);

    if (openPickerAfter && targetParticipantId === selfParticipantId) {
      openSourcePicker();
    }
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

  function closeSourcePicker() {
    setSelectedSourceId(null);
    void onPrepareSource(null, includeSystemAudio);
    setIsSourcePickerOpen(false);
  }

  async function handleStartCapture() {
    if (!selectedSourceId || preparedSourceId !== selectedSourceId || isStartingCapture || isStartingLocally) {
      return;
    }
    const wasAlreadyReceiving = wasReceivingVideoRef.current;
    setIsStartingLocally(true);
    try {
      const started = await onStartCapture();
      if (started) {
        setIsSourcePickerOpen(false);
        if (wasAlreadyReceiving) {
          playStreamStartSound('start');
        }
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
    <main className="relative flex h-full min-h-full flex-col overflow-x-hidden bg-background text-slate-50 lg:h-full lg:flex-row lg:overflow-hidden">
      {/* Overlay sutil ao fundo para garantir efeito premium */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.08),transparent_55%)]" />

      {/* Barra lateral com efeito glass refinado */}
      <aside
        style={{
          ['--sidebar-width' as string]: `${sidebarWidth}px`,
        }}
        className={`relative z-10 flex w-full shrink-0 flex-col border-b border-border/40 bg-slate-950/70 backdrop-blur-xl lg:h-screen lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:border-r border-border/40 shadow-2xl glass-surface-primary ${
          isResizing
            ? 'transition-none select-none'
            : 'transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'
        } ${
          isStreamFullscreen
            ? 'hidden'
            : isSidebarCollapsed
              ? 'h-0 max-h-0 p-0 border-b-0 opacity-0 pointer-events-none select-none overflow-hidden lg:h-screen lg:max-h-none lg:w-[68px] lg:min-w-[68px] lg:border-r lg:p-0 lg:opacity-100 lg:pointer-events-auto'
              : 'p-0 opacity-100 lg:w-[var(--sidebar-width)] lg:opacity-100'
        }`}
      >
        {/* Faixa compacta (mini-rail): avatares dos participantes visíveis com a sidebar recolhida */}
        <div
          aria-hidden={!isSidebarCollapsed}
          className={`absolute inset-0 z-20 hidden flex-col items-center py-4 transition-opacity duration-200 motion-reduce:transition-none lg:flex ${
            isSidebarCollapsed
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none select-none'
          }`}
        >
          {/* Botão de alternar integrado à sidebar no topo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarCollapsed(false)}
                aria-pressed={isSidebarCollapsed}
                aria-label="Expandir barra lateral"
                className="h-9 w-9 shrink-0 rounded-xl border border-border/40 bg-slate-900/60 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 hover:border-border/80 [-webkit-app-region:no-drag]"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              Expandir barra lateral (T)
            </TooltipContent>
          </Tooltip>

          <div className="my-3 w-8 border-b border-border/40" />

          {/* Avatares dos participantes com status e hover revelando o nome */}
          <TooltipProvider delayDuration={50} skipDelayDuration={100}>
            <ul
              aria-label="Participantes"
              className="flex w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto overflow-x-hidden px-1.5 py-1 select-none"
            >
              {room.participants.map((participant) => {
                const isSelf = participant.id === selfParticipantId;
                const railPresenceColor = participant.presence === 'available'
                  ? 'bg-emerald-400'
                  : participant.presence === 'away' ? 'bg-amber-300' : 'bg-red-400';
                const railPresenceLabel = participant.presence === 'available'
                  ? 'Online'
                  : participant.presence === 'away' ? 'Ausente' : 'Ocupado';
                const isParticipantPresenter = participant.id === activePresenterId;

                return (
                  <li key={participant.id} className="shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          tabIndex={isSidebarCollapsed ? 0 : -1}
                          role="img"
                          aria-label={`${participant.displayName}, ${railPresenceLabel}`}
                          className="group relative h-10 w-10 cursor-pointer rounded-xl outline-none ring-1 ring-border/40 transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-primary/60 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/60 motion-reduce:transition-none"
                        >
                          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950/80 shadow-sm">
                            <VoxelAvatar
                              displayName={participant.displayName}
                              seed={
                                isSelf && localAvatarSeedOverride
                                  ? localAvatarSeedOverride
                                  : participant.avatarSeed
                              }
                            />
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 shadow-sm ${railPresenceColor}`}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-100">
                              {participant.displayName}
                            </span>
                            {isSelf && (
                              <span className="rounded bg-primary/20 px-1 py-0.2 text-[10px] font-medium text-primary-200">
                                você
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <span className={`inline-block h-2 w-2 rounded-full ${railPresenceColor}`} />
                            <span>{railPresenceLabel}</span>
                            {isParticipantPresenter && (
                              <span className="text-primary-300">· Apresentador</span>
                            )}
                            {!isParticipantPresenter && participant.role === 'host' && (
                              <span className="text-amber-300/90">· Anfitrião</span>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </TooltipProvider>
        </div>

        {/* Conteúdo completo da barra lateral quando expandida */}
        <div
          className={`flex h-full w-full min-w-0 flex-col overflow-x-hidden p-4 sm:p-5 lg:w-[var(--sidebar-width)] lg:shrink-0 transition-opacity duration-200 motion-reduce:transition-none ${
            isSidebarCollapsed
              ? 'lg:opacity-0 lg:pointer-events-none lg:select-none'
              : 'opacity-100 pointer-events-auto'
          }`}
          aria-hidden={isSidebarCollapsed || undefined}
        >
          <div className="flex items-center justify-between gap-3 border-b border-primary/15 pb-4 [-webkit-app-region:drag]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
                <Radio className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold tracking-tight text-slate-100">TopCast</h1>
                <p className="mt-0.5 text-xs text-slate-400">Sala de transmissão</p>
              </div>
            </div>
            {/* Botão de alternar integrado à sidebar no cabeçalho */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(true)}
                  aria-pressed={isSidebarCollapsed}
                  aria-label="Modo Teatro (recolher barra lateral)"
                  className="h-9 w-9 shrink-0 rounded-xl border border-border/40 bg-slate-900/60 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 hover:border-border/80 [-webkit-app-region:no-drag]"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Modo Teatro: Recolher barra lateral (T)
              </TooltipContent>
            </Tooltip>
          </div>

        {/* Card do Convite */}
        <section aria-label="Convite da sala" className="mt-3.5 w-full min-w-0 rounded-xl border border-border/25 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Convite</h2>
            <span className="text-[11px] font-medium text-slate-400">Expira em {formatRoomTimeRemaining(room.expiresAt, now)}</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-slate-950/60 p-1.5 pl-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-widest text-blue-200">{room.inviteCode}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleCopyCode()}
                  aria-label={isCopied ? 'Código copiado' : 'Copiar código do convite'}
                  className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isCopied ? 'Copiado!' : 'Copiar código de convite'}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Validade: {new Date(room.expiresAt).toLocaleString()}</p>
        </section>

        {/* Lista de Participantes */}
        <section aria-labelledby="participants-heading" className="mt-4 flex min-h-24 w-full min-w-0 flex-1 flex-col overflow-hidden lg:min-h-0">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h2 id="participants-heading" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Participantes</h2>
            <span className="text-[12px] tabular-nums text-slate-400">{room.participants.length}/{room.maxParticipants}</span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-0.5">
            {room.participants.map((participant) => {
              const isSelf = participant.id === selfParticipantId;
              const presenceColor = participant.presence === 'available'
                ? 'bg-emerald-400'
                : participant.presence === 'away' ? 'bg-amber-300' : 'bg-red-400';
              const presenceLabel = participant.presence === 'available'
                ? 'Online'
                : participant.presence === 'away' ? 'Ausente' : 'Ocupado';

              const canKickThisParticipant = isHost && !isSelf && participant.role !== 'host';
              const isParticipantPresenter = participant.id === activePresenterId;
              const canPassPresenterToParticipant =
                (isHost || isPresenter) && !isSelf && !isParticipantPresenter;

              return (
                <li
                  key={participant.id}
                  onClick={() => {
                    if (canKickThisParticipant) {
                      setParticipantToKick({ id: participant.id, displayName: participant.displayName });
                    }
                  }}
                  className={`group flex w-full min-w-0 items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                    canKickThisParticipant
                      ? 'cursor-pointer hover:bg-slate-900/60'
                      : 'hover:bg-slate-900/40'
                  }`}
                  role={canKickThisParticipant ? 'button' : undefined}
                  tabIndex={canKickThisParticipant ? 0 : undefined}
                  onKeyDown={
                    canKickThisParticipant
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setParticipantToKick({ id: participant.id, displayName: participant.displayName });
                          }
                        }
                      : undefined
                  }
                  title={canKickThisParticipant ? `Clique para remover ${participant.displayName} da sala` : undefined}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {/* Avatar com status badge */}
                    <div className="relative shrink-0">
                      <div
                        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-slate-950/80 shadow-sm"
                        role="img"
                        aria-label={`${participant.displayName}, ${presenceLabel}`}
                      >
                        <VoxelAvatar
                          displayName={participant.displayName}
                          seed={
                            isSelf && localAvatarSeedOverride
                              ? localAvatarSeedOverride
                              : participant.avatarSeed
                          }
                        />
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 shadow-sm ${presenceColor}`}
                        title={presenceLabel}
                        aria-label={`Status: ${presenceLabel}`}
                      />
                    </div>

                    <span className="min-w-0 truncate text-sm font-medium text-slate-200">
                      {participant.displayName}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {canPassPresenterToParticipant && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSetPresenter(participant.id);
                            }}
                            aria-label={`Passar transmissão para ${participant.displayName}`}
                            className="grid h-6 w-6 place-items-center rounded-lg border border-border/40 bg-slate-950/70 text-slate-400 transition-colors hover:border-border/80 hover:bg-primary/15 hover:text-primary"
                          >
                            <MonitorUp className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Passar transmissão para {participant.displayName}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isParticipantPresenter && participant.role !== 'host' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Monitor className="h-3 w-3" />Transmissor
                      </span>
                    ) : participant.role === 'host' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        <Crown className="h-3 w-3" />Host
                      </span>
                    ) : (
                      <span className="rounded-full border border-border/40 bg-slate-800/50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                        Convidado
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {participantActionError && (
            <p role="alert" className="mt-2.5 inline-flex w-fit max-w-full self-start items-start gap-2 break-words rounded-xl border border-red-500/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200 topcast-alert-animate">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {participantActionError}
            </p>
          )}
        </section>

        {/* Status da Conexão & Áudio */}
        <div className="relative z-40 mt-4 w-full min-w-0 border-t border-border/30 pt-3 lg:mt-3">
          <section
            aria-label="Status da conexão e transmissão"
            className="relative z-40 w-full min-w-0 rounded-xl border border-border/25 bg-slate-900/40 p-3"
          >
            {/* Header: Sinalização com o Status da Conexão */}
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition-colors ${
                    isRoomConnected
                      ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-400'
                      : 'border-amber-500/20 bg-amber-500/15 text-amber-300 animate-pulse'
                  }`}
                >
                  <Radio className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold tracking-tight text-slate-100">
                    Sinalização conectada
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {isRoomConnected
                      ? rtcConnectedCount > 0
                        ? `${rtcConnectedCount} ${rtcConnectedCount === 1 ? 'conexão P2P ativa' : 'conexões P2P ativas'}`
                        : 'Canal WebSocket pronto'
                      : signalingStatusLabels[signalingStatus]}
                  </span>
                </div>
              </div>

              {/* Status da Conexão (Online / RTC OK / Offline) */}
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shadow-sm select-none transition-colors ${
                  isRoomConnected
                    ? rtcConnectedCount > 0
                      ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-300'
                      : 'border-blue-500/20 bg-blue-500/15 text-blue-300'
                    : 'border-amber-500/20 bg-amber-500/15 text-amber-300'
                }`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {isRoomConnected && rtcConnectedCount > 0 && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                      isRoomConnected
                        ? rtcConnectedCount > 0
                          ? 'bg-emerald-400'
                          : 'bg-blue-400'
                        : 'bg-amber-400'
                    }`}
                  />
                </span>
                <span>
                  {isRoomConnected
                    ? rtcConnectedCount > 0
                      ? 'RTC OK'
                      : 'Online'
                    : 'Offline'}
                </span>
              </span>
            </div>

            {/* Linha de Status de Conexão: Ping / Latência */}
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-slate-950/50 px-2.5 py-1.5 shadow-inner">
              <div className="flex items-center gap-2 text-slate-400">
                <Activity className={`h-3.5 w-3.5 ${connectionPing.iconColor}`} />
                <span className="text-[11px] font-medium text-slate-300">Latência da rede</span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    tabIndex={0}
                    role="status"
                    aria-label={`Qualidade da conexão: ${connectionPing.text}`}
                    className="inline-flex items-center gap-1.5 cursor-help select-none rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <span className="relative flex h-2 w-2">
                      {isRoomConnected && connectionPing.ping !== null && connectionPing.ping < 150 && (
                        <span
                          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${connectionPing.dotColor} opacity-75`}
                        />
                      )}
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${connectionPing.dotColor}`} />
                    </span>
                    <span className={`font-mono text-xs font-semibold ${connectionPing.textColor}`}>
                      {connectionPing.text}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {connectionPing.tooltipText}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Linha Divisória */}
            <div className="my-3 border-t border-border/40" />

            {/* Linha 2: Áudio da Tela & Botão de Efeitos de Áudio */}
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition-colors ${
                    isPresenter
                      ? hasSystemAudio && systemAudioEnabled
                        ? 'border-blue-500/20 bg-blue-500/15 text-blue-400'
                        : 'border-border/30 bg-slate-950/70 text-slate-500'
                      : isReceivingVideo && !isViewerDeafened
                        ? 'border-blue-500/20 bg-blue-500/15 text-blue-400'
                        : 'border-border/30 bg-slate-950/70 text-slate-500'
                  }`}
                >
                  {isPresenter ? (
                    hasSystemAudio && systemAudioEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )
                  ) : isReceivingVideo && !isViewerDeafened ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold tracking-tight text-slate-100">
                    Áudio da tela
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {isPresenter
                      ? !hasSystemAudio
                        ? 'Nenhum som transmitido'
                        : systemAudioEnabled
                        ? 'Transmitindo som'
                        : 'Áudio mutado'
                      : !isReceivingVideo
                        ? 'Nenhum som transmitido'
                        : !isViewerDeafened
                        ? 'Recebendo som'
                        : 'Áudio mutado'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Botão de Top Sounds (Soundboard) que abre para CIMA e para a DIREITA */}
                <TopSoundsDropdown placement="top-right" />

                {(isPresenter ? hasSystemAudio : isReceivingVideo) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={
                          isPresenter
                            ? systemAudioEnabled
                              ? 'Desativar áudio da transmissão'
                              : 'Ativar áudio da transmissão'
                            : !isViewerDeafened
                              ? 'Desativar áudio da transmissão'
                              : 'Ativar áudio da transmissão'
                        }
                        onClick={handleToggleSidebarMute}
                        className={`h-8 px-2.5 text-xs font-medium gap-1.5 rounded-xl border border-border/40 transition-all ${
                          (isPresenter ? systemAudioEnabled : !isViewerDeafened)
                            ? 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                            : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                        }`}
                      >
                        {(isPresenter ? systemAudioEnabled : !isViewerDeafened) ? (
                          <>
                            <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                            <span>Mutar</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5 text-primary" />
                            <span>Ativar</span>
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {(isPresenter ? systemAudioEnabled : !isViewerDeafened)
                        ? 'Mutar o som transmitido'
                        : 'Transmitir o som da tela'}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {!supportsSystemAudio && (
              <p className="mt-2.5 text-center text-[11px] leading-4 text-slate-500">
                Áudio do sistema indisponível nesta plataforma.
              </p>
            )}
          </section>

          {/* Footer: Card do Perfil do Usuário */}
          <div className="mt-3">
            {room.participants
              .filter((participant) => participant.id === selfParticipantId)
              .map((participant) => {
                const presenceColor =
                  participant.presence === 'available'
                    ? 'bg-emerald-400'
                    : participant.presence === 'away'
                    ? 'bg-amber-400'
                    : 'bg-red-400';
                const presenceLabel =
                  participant.presence === 'available'
                    ? 'Disponível'
                    : participant.presence === 'away'
                    ? 'Ausente'
                    : 'Ocupado';

                return (
                  <div
                    key={participant.id}
                    ref={presenceContainerRef}
                    className="relative"
                  >
                    {/* Botão Card do Perfil */}
                    <button
                      type="button"
                      onClick={() => setPresenceSelectOpen((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={presenceSelectOpen}
                      aria-label={`Alterar status de ${participant.displayName}. Status atual: ${presenceLabel}`}
                      className="group flex w-full items-center gap-2.5 rounded-xl border border-border/25 bg-slate-900/40 p-2 text-left transition-colors hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="relative shrink-0" aria-hidden="true">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-slate-950/80 ring-1 ring-border/50 shadow-sm">
                          <VoxelAvatar
                            displayName={participant.displayName}
                            seed={localAvatarSeedOverride || participant.avatarSeed}
                          />
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 shadow-sm ${presenceColor}`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-100 group-hover:text-white">
                          {participant.displayName}
                        </span>
                        <span className="mt-0.5 flex items-center text-[11px] text-slate-400">
                          <span className="truncate">{presenceLabel}</span>
                        </span>
                      </div>

                      {/* Caret Icon */}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors group-hover:text-slate-200">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-150 ease-out ${
                            presenceSelectOpen ? 'rotate-180 text-primary' : 'rotate-0'
                          }`}
                        />
                      </span>
                    </button>

                    {/* Dropdown Menu com Glass styling */}
                    <div
                      className={`absolute bottom-full left-0 right-0 z-50 pb-2 transition-all duration-150 ease-out ${
                        presenceSelectOpen
                          ? 'pointer-events-auto opacity-100 translate-y-0'
                          : 'pointer-events-none opacity-0 translate-y-1'
                      }`}
                      role="listbox"
                      aria-label="Opções de status de presença e avatar"
                    >
                      <div className="flex flex-col gap-1 overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl">
                        {/* Miniatura da foto de perfil e atalho para configurações de perfil */}
                        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-border/40 bg-slate-950/60 p-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-slate-900 shadow-inner">
                              <VoxelAvatar
                                displayName={participant.displayName}
                                seed={localAvatarSeedOverride || participant.avatarSeed}
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-slate-200">
                                Avatar
                              </span>
                              <span className="block truncate text-[10px] text-slate-400">
                                Foto de perfil
                              </span>
                            </div>
                          </div>

                          <SettingsDialog
                            defaultTab="user"
                            showProfileTab
                            triggerLabel="Configurações de perfil"
                            tooltipText="Configurações de perfil"
                            triggerClassName="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-slate-900 text-slate-400 shadow-sm transition-colors duration-150 hover:border-border/80 hover:bg-slate-800 hover:text-slate-100 active:scale-95"
                            onOpenChange={(open) => {
                              if (open) {
                                setPresenceSelectOpen(false);
                              }
                            }}
                            displayName={participant.displayName}
                            onDisplayNameChange={(name) => void handleDisplayNameChange(name)}
                            avatarSeed={localAvatarSeedOverride || participant.avatarSeed}
                            onAvatarSeedChange={(seed) => void handleAvatarSeedChange(seed)}
                            presence={participant.presence}
                            onPresenceChange={(nextPresence) => handlePresenceChange(nextPresence)}
                          />
                        </div>

                        {/* Divisória sutil */}
                        <div className="my-1 border-t border-border/40" />
                        {[
                          { value: 'available', label: 'Disponível', dotColor: 'bg-emerald-400' },
                          { value: 'away', label: 'Ausente', dotColor: 'bg-amber-400' },
                          { value: 'busy', label: 'Ocupado', dotColor: 'bg-red-400' },
                        ].map((option) => {
                          const isSelected = participant.presence === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                handlePresenceChange(option.value);
                                setPresenceSelectOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                                isSelected
                                  ? 'bg-slate-800 text-white font-semibold shadow-sm'
                                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                <span className={`h-2 w-2 rounded-full ${option.dotColor}`} />
                                <span>{option.label}</span>
                              </span>
                              {isSelected && <Check className="h-3.5 w-3.5 text-blue-400" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          </div>
        </div>

        {/* Separador de redimensionamento da sidebar */}
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
              className={`group absolute right-0 top-0 bottom-0 z-20 w-3 cursor-col-resize select-none touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isSidebarCollapsed ? 'hidden' : 'hidden lg:block'
              }`}
            >
              <div
                className={`ml-auto h-full w-[2px] transition-colors duration-150 ${
                  isResizing
                    ? 'bg-primary'
                    : 'bg-transparent group-hover:bg-primary/50 group-focus-visible:bg-primary'
                }`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            Arraste para redimensionar (clique duplo para redefinir)
          </TooltipContent>
        </Tooltip>
      </aside>

      {/* Área Principal */}
      <div
        className={`relative mx-auto flex min-h-full w-full flex-1 flex-col ${
          isResizing
            ? 'transition-none select-none'
            : 'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'
        } ${
          isStreamFullscreen
            ? 'max-w-none p-0'
            : `${isSidebarCollapsed ? 'max-w-none' : 'max-w-[1600px]'} px-4 py-4 sm:px-6 sm:py-5 lg:min-h-0 lg:px-6 lg:py-5`
        }`}
      >
        <header className={`flex shrink-0 items-center justify-between gap-4 border-b border-border/40 pb-4 [-webkit-app-region:drag] ${isStreamFullscreen ? 'hidden' : ''}`}>
          <div className="flex items-center gap-3">
            {/* Botão de alternar em telas menores onde a sidebar fecha por completo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  aria-pressed={isSidebarCollapsed}
                  aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Modo Teatro (recolher barra lateral)'}
                  className={`h-9 w-9 shrink-0 rounded-xl border transition-colors lg:hidden [-webkit-app-region:no-drag] ${
                    isSidebarCollapsed
                      ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
                      : 'border-border/40 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {isSidebarCollapsed ? (
                    <ChevronsRight className="h-4 w-4" />
                  ) : (
                    <ChevronsLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isSidebarCollapsed ? 'Expandir barra lateral (T)' : 'Modo Teatro: Recolher barra lateral (T)'}
              </TooltipContent>
            </Tooltip>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-100">Sala de transmissão</h2>
              <p className="mt-0.5 text-xs text-slate-400">{isPresenter ? 'Compartilhe sua tela com a sala' : 'Acompanhe a transmissão'}</p>
            </div>
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
                    className="h-9 w-9 rounded-xl border border-border/40 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Guia de Boas-Vindas</TooltipContent>
              </Tooltip>
            )}
            <SettingsDialog
              showProfileTab
              displayName={
                room.participants.find((p) => p.id === selfParticipantId)?.displayName
              }
              onDisplayNameChange={(name) => void handleDisplayNameChange(name)}
              avatarSeed={
                localAvatarSeedOverride ||
                room.participants.find((p) => p.id === selfParticipantId)?.avatarSeed
              }
              onAvatarSeedChange={(seed) => void handleAvatarSeedChange(seed)}
              presence={
                room.participants.find((p) => p.id === selfParticipantId)?.presence
              }
              onPresenceChange={(nextPresence) => handlePresenceChange(nextPresence)}
            />
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
                        className="h-9 gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 text-xs font-medium text-red-300 shadow-sm transition-all hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-200"
                      >
                        <LogOut className="h-4 w-4" />
                        {isLeaving ? 'Encerrando…' : 'Encerrar sala'}
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Encerrar sala para todos os participantes
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent className="max-w-md overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-0 text-slate-100 shadow-2xl sm:max-w-md">

                  {/* Header com borda inferior igual aos outros dialogs */}
                  <div className="relative z-10 border-b border-border/40 px-6 py-5">
                    <div className="flex items-center gap-3.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 shadow-sm">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <AlertDialogTitle className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
                          Encerrar esta sala?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="mt-0.5 text-xs text-slate-400">
                          Confirmação de encerramento da transmissão
                        </AlertDialogDescription>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo com detalhes e aviso claro */}
                  <div className="relative z-10 px-6 py-5">
                    <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Todos os participantes conectados serão desconectados imediatamente e o código de convite deixará de funcionar.
                    </p>
                    <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span>Esta ação é definitiva e encerrará a transmissão no servidor para todos os membros.</span>
                    </div>
                  </div>

                  {/* Footer padronizado com os botões do sistema */}
                  <div className="relative z-10 flex flex-col-reverse gap-2.5 border-t border-border/40 bg-slate-950/40 px-6 py-4 sm:flex-row sm:justify-end">
                    <AlertDialogCancel className="w-full sm:w-auto h-9 rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100 hover:border-slate-600/60 focus-visible:ring-slate-400">
                      Manter sala
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeave}
                      className="w-full sm:w-auto h-9 gap-2 rounded-xl border border-red-500/30 bg-red-600 px-4 text-xs font-medium text-white shadow-sm transition-all hover:bg-red-500 active:scale-[0.98] focus-visible:ring-red-400"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Encerrar sala</span>
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
                    className="h-9 gap-2 rounded-xl border border-border/40 bg-slate-900/60 px-3.5 text-xs font-medium text-slate-300 shadow-sm transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <LogOut className="h-4 w-4" />
                    {isLeaving ? 'Saindo…' : 'Sair da sala'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Sair desta sala de transmissão
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>

        {/* Player / Área Central da Stream */}
        <div className={`flex flex-1 flex-col ${isStreamFullscreen ? 'p-0 gap-0' : 'gap-4 py-4 lg:min-h-0 lg:py-5'}`}>
          <div className={`flex min-w-0 flex-1 flex-col ${isStreamFullscreen ? 'gap-0' : 'gap-4 lg:min-h-0'}`}>
            <section
              className={`relative flex flex-col items-center justify-center transition-all duration-150 ${
                isStreamFullscreen
                  ? 'fixed inset-0 z-[100] h-screen w-screen bg-black p-0 rounded-none border-none overflow-hidden'
                  : 'min-h-[340px] flex-1 overflow-hidden rounded-2xl border border-border/40 bg-slate-900/50 backdrop-blur-md p-4 shadow-md sm:min-h-[420px] sm:p-5 lg:min-h-0'
              }`}
            >
              {presentationStream && isReceivingVideo ? (
                <>
                  {!isStreamFullscreen && (
                    <div className="mb-3.5 flex w-full shrink-0 items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        <span>{isPresenter ? 'Sua tela está sendo compartilhada' : `${presenter?.displayName ?? host?.displayName ?? 'Host'} está compartilhando`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.dispatchEvent(new CustomEvent('topcast:request-fullscreen'))}
                              className="h-9 gap-2 rounded-xl border border-border/40 bg-slate-900/60 px-3.5 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100"
                              aria-label="Entrar em tela cheia"
                            >
                              <Maximize className="h-3.5 w-3.5" />
                              <span>Tela cheia</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Expandir transmissão em tela cheia (F)
                          </TooltipContent>
                        </Tooltip>

                        {isHost && !isPresenter && selfParticipantId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleSetPresenter(selfParticipantId)}
                                className="h-9 gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 text-xs font-medium text-amber-300 shadow-sm transition-all hover:border-amber-500/40 hover:bg-amber-500/20 hover:text-amber-200"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Retomar transmissão</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Retomar o controle da transmissão como Host
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {isPresenter && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-pressed={isLocalPreviewHidden}
                                  aria-label={isLocalPreviewHidden ? 'Mostrar prévia local' : 'Ocultar prévia local'}
                                  onClick={() => setIsLocalPreviewHidden((prev) => !prev)}
                                  className={`h-9 gap-2 rounded-xl border px-3.5 text-xs font-medium shadow-sm transition-all ${
                                    isLocalPreviewHidden
                                      ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
                                      : 'border-border/40 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                                  }`}
                                >
                                  {isLocalPreviewHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                  <span>{isLocalPreviewHidden ? 'Mostrar prévia' : 'Ocultar prévia'}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {isLocalPreviewHidden
                                  ? 'Voltar a exibir a prévia da sua tela no player'
                                  : 'Ocultar prévia local para evitar o efeito de espelho infinito'}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-pressed={isStreamPaused}
                                  aria-label={isStreamPaused ? 'Retomar transmissão' : 'Pausar transmissão'}
                                  onClick={handleToggleStreamPause}
                                  className={`h-9 gap-2 rounded-xl border px-3.5 text-xs font-medium shadow-sm transition-all ${
                                    isStreamPaused
                                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                                      : 'border-border/40 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                                  }`}
                                >
                                  {isStreamPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                                  <span>{isStreamPaused ? 'Retomar' : 'Pausar'}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {isStreamPaused
                                  ? 'Retomar envio de imagem e som da sua tela'
                                  : 'Pausar temporariamente a transmissão (modo privacidade)'}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={openSourcePicker}
                                  className="h-9 gap-2 rounded-xl border border-border/40 bg-slate-900/60 px-3.5 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  <span>Mudar tela</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Alterar a tela ou janela transmitida sem interromper a transmissão
                              </TooltipContent>
                            </Tooltip>

                            {!isHost && host && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleSetPresenter(host.id)}
                                    className="h-9 gap-2 rounded-xl border border-border/40 bg-slate-900/60 px-3.5 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>Devolver ao Host</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Encerrar sua apresentação e devolver controle para {host.displayName}
                                </TooltipContent>
                              </Tooltip>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={onStopCapture}
                                  className="h-9 gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 text-xs font-medium text-red-300 shadow-sm transition-all hover:border-red-500/30 hover:bg-red-500/20 hover:text-red-200"
                                >
                                  <StopCircle className="h-3.5 w-3.5" />
                                  <span>Parar compartilhamento</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Interromper transmissão da sua tela
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    className={
                      isStreamFullscreen
                        ? 'relative h-full w-full bg-black overflow-hidden'
                        : 'relative flex-1 min-h-0 aspect-video max-h-full w-full overflow-hidden rounded-xl border border-border/30 bg-black shadow-inner'
                    }
                  >
                    <StreamVideo
                      stream={presentationStream}
                      isHost={isPresenter}
                      participants={room.participants}
                      selfParticipantId={selfParticipantId}
                      localAvatarSeedOverride={localAvatarSeedOverride}
                      hasSystemAudio={hasSystemAudio}
                      systemAudioEnabled={systemAudioEnabled}
                      onToggleSystemAudio={onToggleSystemAudio}
                      isStreamPaused={isStreamPaused}
                      onToggleStreamPause={isPresenter ? handleToggleStreamPause : undefined}
                      isLocalPreviewHidden={isLocalPreviewHidden}
                      onToggleLocalPreviewHidden={isPresenter ? () => setIsLocalPreviewHidden((prev) => !prev) : undefined}
                      isViewerDeafened={isViewerDeafened}
                      onToggleViewerDeafen={setIsViewerDeafened}
                      qualityPreset={qualityPreset}
                      onSetQualityPreset={onSetQualityPreset}
                      getPeerConnections={getPeerConnections}
                    />
                  </div>
                </>
              ) : (
                <div className="relative flex w-full flex-col items-center justify-center py-6 text-center">
                  {/* Iluminação ambiente e grade de fundo sutil */}
                 

                  {/* Badge de status da sala */}
                  <div className="relative mb-5 inline-flex items-center gap-2 rounded-full border border-border/40 bg-slate-950/70 px-3.5 py-1 text-xs text-slate-300 shadow-sm backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="font-medium">
                      {isPresenter ? 'Sala Pronta para Transmissão' : 'Aguardando Início do Host'}
                    </span>
                  </div>

                  {/* Ícone principal com acabamento refinado */}
                  <div className="relative mb-4">
                    <div className="grid h-20 w-20 place-items-center rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/20 via-primary/10 to-transparent text-primary backdrop-blur-sm">
                      <Monitor className="h-9 w-9 text-primary" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-lg border border-border/50 bg-slate-900 text-primary shadow-md">
                      <Radio className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  {/* Títulos e descrição profissional */}
                  <h2 className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {isPresenter ? 'Compartilhe sua tela' : 'Aguardando transmissão'}
                  </h2>
                  <p className="relative mt-2.5 max-w-lg text-center text-sm leading-relaxed text-slate-400">
                    {isPresenter
                      ? 'Transmita monitores inteiros ou janelas específicas com áudio em alta definição e latência ultrabaixa para todos na sala.'
                      : `${presenter?.displayName ?? 'O host'} ainda não iniciou a transmissão. O vídeo da tela aparecerá automaticamente aqui assim que começar.`}
                  </p>

                  {/* Chips informativos das funcionalidades */}
                  <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 max-w-lg">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300 shadow-sm backdrop-blur-sm">
                      <Layers className="h-3.5 w-3.5 text-blue-400" />
                      <span>Monitores & Janelas</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300 shadow-sm backdrop-blur-sm">
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Áudio Integrado</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300 shadow-sm backdrop-blur-sm">
                      <Radio className="h-3.5 w-3.5 text-indigo-400" />
                      <span>WebRTC P2P Direto</span>
                    </div>
                  </div>

                  {/* Botão de ação (Transmissor) ou indicador de espera + opção de assumir */}
                  {isPresenter ? (
                    <div className="relative mt-7 flex flex-wrap items-center justify-center gap-2.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="lg"
                            onClick={openSourcePicker}
                            className="h-11 gap-2.5 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-primary/35 active:scale-[0.98] focus-visible:ring-primary"
                          >
                            <Monitor className="h-4 w-4" />
                            <span>Compartilhar tela</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Selecionar tela ou janela para transmitir
                        </TooltipContent>
                      </Tooltip>

                      {!isHost && host && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="lg"
                              onClick={() => void handleSetPresenter(host.id)}
                              className="h-11 gap-2 rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Devolver ao Host</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Devolver controle de transmissão para {host.displayName}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  ) : (
                    <div className="relative mt-7 flex flex-col items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-slate-950/50 px-4 py-2 text-xs text-slate-400 shadow-sm backdrop-blur-md">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                        <span>Conectado à sala &middot; Sincronizando transmissão</span>
                      </div>

                      {selfParticipantId && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleSetPresenter(selfParticipantId, true)}
                              className="h-9 gap-2 rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300 shadow-sm transition-all hover:border-border/80 hover:bg-slate-800 hover:text-slate-100"
                            >
                              <MonitorUp className="h-3.5 w-3.5 text-primary" />
                              <span>{isHost ? 'Retomar transmissão' : 'Transmitir minha tela'}</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {isHost
                              ? 'Retomar controle da transmissão e escolher tela'
                              : 'Assumir transmissão para compartilhar sua tela na sala'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
              )}

              {captureError && isPresenter && !isSourcePickerOpen && (
                <p role="alert" className="mx-auto mt-4 inline-flex w-fit max-w-full items-start gap-2 break-words rounded-xl border border-red-500/20 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-200 topcast-alert-animate">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  {captureError}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Tela / Janela com Glass Styling */}
      <Dialog open={isSourcePickerOpen} onOpenChange={(open) => !open && closeSourcePicker()}>
        <DialogContent className="flex max-h-[88vh] w-full max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border border-border/40 bg-card p-0 text-slate-100 shadow-2xl sm:max-w-4xl glass-surface-elevated">
          <DialogHeader className="border-b border-border/40 px-6 py-5 text-left">
            <div className="flex items-center gap-3.5 pr-8">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <Monitor className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  {presentationStream ? 'Alterar tela de transmissão' : 'Escolha o que compartilhar'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-slate-400 sm:text-sm">
                  {presentationStream
                    ? 'Selecione uma nova tela ou janela para transmitir sem interromper a transmissão.'
                    : 'Selecione uma tela inteira ou janela de aplicativo para transmitir à sala.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-slate-950/40 px-6 py-3">
            <div role="tablist" aria-label="Tipo de origem" className="inline-flex rounded-xl border border-border/40 bg-slate-950/70 p-1">
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
                    className={`inline-flex h-8 items-center gap-2 rounded-lg px-3.5 text-xs font-medium transition-all duration-200 ease-out active:scale-95 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <SourceIcon className="h-3.5 w-3.5 transition-transform duration-200" />
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
                    className="h-8 gap-2 px-3 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    {isLoadingSources ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Atualizar
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Atualizar lista de telas e janelas
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {captureError && (
              <p role="alert" className="mb-4 flex w-fit max-w-full items-start gap-2.5 break-words rounded-xl border border-red-500/20 bg-red-400/10 px-3.5 py-3 text-sm leading-5 text-red-200 topcast-alert-animate">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                {captureError}
              </p>
            )}

            <div key={sourceKind} className="topcast-tab-panel-animate">
              {isLoadingSources && filteredSources.length === 0 && (
              <div role="status" className="flex min-h-64 flex-col items-center justify-center gap-3.5 text-center">
                <div className="flex h-10 w-10 items-center justify-center text-primary">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold tracking-tight text-slate-100">
                    Buscando {sourceKind === 'screen' ? 'telas' : 'janelas'}…
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-normal text-slate-400">
                    Identificando janelas e monitores ativos no sistema.
                  </p>
                </div>
              </div>
            )}

            {!isLoadingSources && filteredSources.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-border/40 bg-slate-950/30 px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-border/40 bg-slate-800/70 text-slate-400">
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
                      className={`group flex flex-col overflow-hidden rounded-xl text-left border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-wait disabled:opacity-60 ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                          : 'border-border/40 bg-slate-900/80 hover:border-primary/50 hover:bg-slate-900'
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                        <SourceThumbnail source={source} sourceKind={sourceKind} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

                        {isSelected && (
                          <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 px-3 py-2.5">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {source.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/40 bg-slate-950/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  role="radiogroup"
                  aria-label="Qualidade da transmissão"
                  className="inline-flex rounded-xl border border-border/40 bg-slate-950/70 p-1"
                >
                  {STREAM_QUALITY_PRESET_LIST.map((preset) => {
                    const isActive = qualityPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => onSetQualityPreset?.(preset.id)}
                        className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                      >
                        <span>{preset.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {supportsSystemAudio && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeSystemAudio}
                  aria-label="Compartilhar áudio do sistema"
                  onClick={() => {
                    onSetIncludeSystemAudio?.(!includeSystemAudio);
                  }}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all ${
                    includeSystemAudio
                      ? 'border-primary/40 bg-primary/15 text-slate-100 shadow-sm hover:bg-primary/20'
                      : 'border-border/40 bg-slate-950/70 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  {includeSystemAudio ? (
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>Áudio do sistema</span>
                  <span
                    className={`ml-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      includeSystemAudio ? 'bg-primary' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                        includeSystemAudio ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
              )}
            </div>
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
                className="min-w-[140px] gap-2 bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {isStartingCapture || isStartingLocally ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{presentationStream ? 'Alterando…' : 'Iniciando…'}</span>
                  </>
                ) : (
                  <>
                    {presentationStream ? <RefreshCw className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                    <span>{presentationStream ? 'Alterar tela' : 'Compartilhar'}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de expulsão de participante com AlertDialog */}
      <AlertDialog open={Boolean(participantToKick)} onOpenChange={(open) => !open && setParticipantToKick(null)}>
        <AlertDialogContent className="max-w-md overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-0 text-slate-100 shadow-2xl sm:max-w-md">

          {/* Header com borda inferior */}
          <div className="relative z-10 border-b border-border/40 px-6 py-5">
            <div className="flex items-center gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 shadow-sm">
                <UserX className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
                  Remover participante?
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-0.5 text-xs text-slate-400">
                  Desconectar {participantToKick?.displayName} da sala
                </AlertDialogDescription>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="relative z-10 px-6 py-5">
            <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
              Tem certeza que deseja remover <strong className="font-semibold text-slate-100">{participantToKick?.displayName}</strong> da transmissão? O participante será desconectado imediatamente.
            </p>
          </div>

          {/* Footer com botões padronizados */}
          <div className="relative z-10 flex flex-col-reverse gap-2.5 border-t border-border/40 bg-slate-950/40 px-6 py-4 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              onClick={() => setParticipantToKick(null)}
              className="w-full sm:w-auto h-9 rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100 hover:border-slate-600/60 focus-visible:ring-slate-400"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (participantToKick) {
                  confirmKick(participantToKick.id);
                  setParticipantToKick(null);
                }
              }}
              className="w-full sm:w-auto h-9 gap-2 rounded-xl border border-red-500/30 bg-red-600 px-4 text-xs font-medium text-white shadow-sm transition-all hover:bg-red-500 active:scale-[0.98] focus-visible:ring-red-400"
            >
              <UserX className="h-4 w-4" />
              <span>Remover da sala</span>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading Overlay ao sair da sala */}
      {isLeaving && (
        <LoadingOverlay
          title="Saindo da sala…"
          description="Encerrando a transmissão e desconectando..."
        />
      )}

      {/* Notificação Toast com efeito Glass */}
      {toastMessage && (
        <div
          role={toastTone === 'error' ? 'alert' : 'status'}
          aria-live={toastTone === 'error' ? 'assertive' : 'polite'}
          className={`fixed right-4 top-4 z-[90] flex w-fit max-w-[min(24rem,calc(100vw-2rem))] items-start gap-2.5 break-words rounded-xl border border-border/40 bg-slate-900/90 px-4 py-3 text-sm shadow-xl backdrop-blur-xl sm:right-6 sm:top-6 topcast-toast-animate glass-surface-elevated ${
            toastTone === 'error'
              ? 'text-red-100 shadow-red-950/20'
              : 'text-slate-100'
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
