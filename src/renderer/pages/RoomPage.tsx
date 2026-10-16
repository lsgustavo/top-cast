import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  AppWindow,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Crown,
  Dice5,
  HelpCircle,
  Layers,
  Loader2,
  LogOut,
  Maximize,
  Minimize,
  Monitor,
  Radio,
  RefreshCw,
  StopCircle,
  UserX,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { SettingsDialog } from "../components/settings-dialog";
import { AudioEffectsDialog } from "../components/audio-effects-dialog";
import { SoundboardDialog } from "../components/soundboard-dialog";
import { TopSoundsDropdown } from "../components/top-sounds-dropdown";
import { SourceThumbnail } from "../components/source-thumbnail";
import Strands from "../components/Strands";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { LoadingOverlay } from "../components/ui/loading-overlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  formatRoomTimeRemaining,
  getParticipantAvatarHue,
  getParticipantInitials,
} from "../lib/room-ui";
import {
  generateRandomAvatarSeed,
  saveLocalAvatarSeed,
} from "../lib/voxel-avatar";
import { VoxelAvatar } from "../components/voxel-avatar";
import { updateAvatar } from "../lib/room-client";
import { useConnectionPing } from "../lib/use-connection-ping";
import type { RoomSnapshot } from "../../shared/types/signaling";
import type { CaptureSource } from "../../shared/types/desktop-api";
import type { SignalingStatus } from "../../shared/types/signaling";
import type { SignalingClient } from "../lib/signaling-client";
import type { PeerConnectionStatus } from "../features/streaming/use-room-webrtc";

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
  onPrepareSource: (
    sourceId: string | null,
    includeSystemAudio?: boolean,
  ) => Promise<boolean>;
  onSetIncludeSystemAudio?: (include: boolean) => void;
  onStartCapture: () => Promise<boolean>;
  onStopCapture: () => void;
  onToggleSystemAudio: (enabled: boolean) => void;
  onLeaveRequested: () => void;
  onLeave: () => void;
  onOpenWelcome?: () => void;
}

interface StreamVideoProps {
  stream: MediaStream;
  isHost?: boolean;
}

function StreamVideo({ stream, isHost = false }: StreamVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(isHost);
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVolumeRef = useRef(1);

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
  }, [volume, isMuted, isHost]);

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
      window.dispatchEvent(
        new CustomEvent("topcast:fullscreen-change", {
          detail: { isFullscreen: active },
        }),
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
      window.dispatchEvent(
        new CustomEvent("topcast:fullscreen-change", {
          detail: { isFullscreen: false },
        }),
      );
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
            } else if (
              doc.fullscreenElement !== undefined &&
              document.documentElement.requestFullscreen
            ) {
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
            console.warn(
              "[StreamVideo] HTML5 requestFullscreen falhou, aplicando fallback:",
              apiErr,
            );
          }
        }

        // Se a chamada da Fullscreen API não ocorreu ou falhou, usa fallback de viewport e sincroniza Electron
        if (!apiSucceeded) {
          if (
            window.topCast?.isFullScreen &&
            window.topCast?.toggleFullScreen
          ) {
            try {
              const isWindowFs = await window.topCast.isFullScreen();
              if (!isWindowFs) {
                await window.topCast.toggleFullScreen();
              }
            } catch {
              // Ignora
            }
          }
        }
        setIsFullscreen(true);
        window.dispatchEvent(
          new CustomEvent("topcast:fullscreen-change", {
            detail: { isFullscreen: true },
          }),
        );
      } else {
        try {
          if (
            doc.fullscreenElement ||
            doc.webkitFullscreenElement ||
            doc.mozFullScreenElement ||
            doc.msFullscreenElement
          ) {
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
          console.warn("[StreamVideo] HTML5 exitFullscreen falhou:", exitErr);
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
        window.dispatchEvent(
          new CustomEvent("topcast:fullscreen-change", {
            detail: { isFullscreen: false },
          }),
        );
      }
    } catch (err) {
      console.warn("[StreamVideo] Erro ao alternar tela cheia:", err);
      const next = !isFullscreen;
      setIsFullscreen(next);
      window.dispatchEvent(
        new CustomEvent("topcast:fullscreen-change", {
          detail: { isFullscreen: next },
        }),
      );
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
    } else {
      prevVolumeRef.current = volume;
      setIsMuted(true);
    }
    resetHideTimer();
  };

  const handleVolumeChange = (newVolume: number) => {
    if (isHost) return;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    } else if (newVolume === 0) {
      setIsMuted(true);
    }
    resetHideTimer();
  };

  // Atalhos de teclado: F para tela cheia (todos os usuários), Esc para sair, M para mutar (estritamente para quem assiste)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        void toggleFullscreen();
      } else if ((e.key === "m" || e.key === "M") && !isHost) {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, isMuted, volume, isHost]);

  useEffect(() => {
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
          ? "fixed inset-0 z-[100] h-screen w-screen"
          : "relative h-full w-full"
      } ${isFullscreen && !showControls ? "cursor-none" : "cursor-default"}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isHost ? true : isMuted}
        onDoubleClick={() => void toggleFullscreen()}
        className="h-full w-full bg-black object-contain cursor-pointer"
      />

      {/* Barra de controles flutuante sobre o vídeo com efeito glass */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 py-3 sm:px-5 sm:py-4 transition-opacity duration-200 ${
          showControls
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setShowControls(true);
        }}
      >
        {/* Esquerda: Badge Ao Vivo e Controle de Volume (estritamente para convidados/viewers) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm backdrop-blur-md select-none">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span>AO VIVO</span>
          </div>

          {/* Slider de volume renderizado estritamente para o convidado */}
          {!isHost && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-slate-900/80 px-3 py-1.5 backdrop-blur-md shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-7 w-7 rounded-lg border border-border/40 bg-slate-900/60 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                title={isMuted ? "Ativar som (M)" : "Silenciar (M)"}
                aria-label={isMuted ? "Ativar som" : "Silenciar"}
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

        {/* Direita: Top Sounds (Soundboard) e Botão de Modo Tela Cheia */}
        <div className="flex items-center gap-2">
          {/* Top Sounds Dropdown para usar na transmissão (abre para CIMA e para a ESQUERDA) */}
          <TopSoundsDropdown placement="top-left" triggerSize="default" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void toggleFullscreen()}
                className="h-9 w-9 rounded-xl border border-border/40 bg-slate-900/60 text-slate-300 backdrop-blur-md shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100 active:scale-95 focus-visible:ring-primary"
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isFullscreen
                ? "Sair da tela cheia (F ou Esc)"
                : "Tela cheia (F)"}
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
const SIDEBAR_WIDTH_STORAGE_KEY = "topcast:sidebar-width";

function getSavedSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  const saved = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  if (saved) {
    const parsed = Number.parseInt(saved, 10);
    if (
      !Number.isNaN(parsed) &&
      parsed >= MIN_SIDEBAR_WIDTH &&
      parsed <= MAX_SIDEBAR_WIDTH
    ) {
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
  onStartCapture,
  onStopCapture,
  onToggleSystemAudio,
  onLeaveRequested,
  onLeave,
  onOpenWelcome,
}: RoomPageProps) {
  const [toastMessage, setToastMessage] = useState("");
  const [toastTone, setToastTone] = useState<"success" | "error">("success");
  const [isCopied, setIsCopied] = useState(false);
  const [participantActionError, setParticipantActionError] = useState("");
  const [participantToKick, setParticipantToKick] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const toastTimerRef = useRef<number | null>(null);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [presenceSelectOpen, setPresenceSelectOpen] = useState(false);
  const presenceCloseTimeoutRef = useRef<number | null>(null);
  const [localAvatarSeedOverride, setLocalAvatarSeedOverride] = useState<
    string | null
  >(null);
  const [isStartingLocally, setIsStartingLocally] = useState(false);
  const [sourceKind, setSourceKind] = useState<CaptureSource["kind"]>("screen");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedSidebarWidth);
  const [isStreamFullscreen, setIsStreamFullscreen] = useState(false);
  const connectionPing = useConnectionPing(socket, signalingStatus);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(sidebarWidth);

  function clampSidebarWidth(width: number): number {
    const maxAllowed = Math.min(
      MAX_SIDEBAR_WIDTH,
      typeof window !== "undefined"
        ? Math.floor(window.innerWidth * 0.45)
        : MAX_SIDEBAR_WIDTH,
    );
    return Math.min(
      Math.max(width, MIN_SIDEBAR_WIDTH),
      Math.max(MIN_SIDEBAR_WIDTH, maxAllowed),
    );
  }

  function handleResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    isResizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = sidebarWidth;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
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
      (event.currentTarget as HTMLElement).releasePointerCapture(
        event.pointerId,
      );
    } catch {
      // ignore
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    const deltaX = event.clientX - startXRef.current;
    const finalWidth = clampSidebarWidth(startWidthRef.current + deltaX);
    try {
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(finalWidth),
      );
    } catch {
      // ignore
    }
  }

  function handleResetSidebarWidth() {
    const defaultWidth = clampSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    setSidebarWidth(defaultWidth);
    try {
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(defaultWidth),
      );
    } catch {
      // ignore
    }
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let delta = 0;
    if (event.key === "ArrowRight") delta = event.shiftKey ? 30 : 10;
    else if (event.key === "ArrowLeft") delta = event.shiftKey ? -30 : -10;
    else if (event.key === "Home") delta = MIN_SIDEBAR_WIDTH - sidebarWidth;
    else if (event.key === "End") delta = MAX_SIDEBAR_WIDTH - sidebarWidth;
    else if (event.key === "Enter" || event.key === " ") {
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
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const isHost = room.participants.some(
    (participant) =>
      participant.id === selfParticipantId && participant.role === "host",
  );
  const host = room.participants.find(
    (participant) => participant.role === "host",
  );
  const remoteHostStream = host ? (remoteStreams[host.id] ?? null) : null;
  const presentationStream = isHost ? localStream : remoteHostStream;
  const isReceivingVideo =
    presentationStream !== null &&
    (isHost ||
      presentationStream
        .getVideoTracks()
        .some((track) => !track.muted && track.readyState === "live"));
  const filteredSources = captureSources.filter(
    (source) => source.kind === sourceKind,
  );
  const signalingStatusLabels: Record<SignalingStatus, string> = {
    connected: "Conectado",
    reconnecting: "Reconectando…",
    restoring: "Restaurando sala…",
  };
  const rtcConnectedCount = Object.values(connectionStates).filter(
    (status) => status === "connected",
  ).length;
  const isRoomConnected =
    signalingStatus === "connected" &&
    (room.participants.length <= 1 || rtcConnectedCount > 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      window.clearInterval(timer);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (presenceCloseTimeoutRef.current !== null) {
        window.clearTimeout(presenceCloseTimeoutRef.current);
      }
    };
  }, []);

  // Sincroniza estado de tela cheia disparado pelo StreamVideo para eliminar contenção CSS
  useEffect(() => {
    const handleFullscreenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ isFullscreen: boolean }>;
      if (typeof customEvent.detail?.isFullscreen === "boolean") {
        setIsStreamFullscreen(customEvent.detail.isFullscreen);
      }
    };
    window.addEventListener("topcast:fullscreen-change", handleFullscreenEvent);
    return () => {
      window.removeEventListener(
        "topcast:fullscreen-change",
        handleFullscreenEvent,
      );
    };
  }, []);

  useEffect(() => {
    if (!presentationStream || !isReceivingVideo) {
      setIsStreamFullscreen(false);
    }
  }, [presentationStream, isReceivingVideo]);

  function handlePresenceMouseEnter() {
    if (presenceCloseTimeoutRef.current !== null) {
      window.clearTimeout(presenceCloseTimeoutRef.current);
      presenceCloseTimeoutRef.current = null;
    }
    setPresenceSelectOpen(true);
  }

  function handlePresenceMouseLeave() {
    if (presenceCloseTimeoutRef.current !== null) {
      window.clearTimeout(presenceCloseTimeoutRef.current);
    }
    presenceCloseTimeoutRef.current = window.setTimeout(() => {
      setPresenceSelectOpen(false);
      presenceCloseTimeoutRef.current = null;
    }, 180);
  }

  async function handleCopyCode() {
    let duration = 2_000;
    try {
      if (window.topCast?.copyToClipboard) {
        await window.topCast.copyToClipboard(room.inviteCode);
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(room.inviteCode);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = room.inviteCode;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!success) throw new Error("Falha ao copiar");
      }

      setIsCopied(true);
      setToastTone("success");
      setToastMessage("Código copiado para a área de transferência!");
    } catch {
      duration = 4_500;
      setIsCopied(false);
      setToastTone("error");
      setToastMessage("Não foi possível copiar o código.");
    }

    if (toastTimerRef.current !== null)
      window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      setIsCopied(false);
    }, duration);
  }

  function handlePresenceChange(value: string) {
    if (value !== "available" && value !== "away" && value !== "busy") {
      setParticipantActionError("Estado de presença inválido.");
      return;
    }
    setParticipantActionError("");
    socket.emit("room:presence", { presence: value }, (result) => {
      if (!result.ok) {
        setParticipantActionError(
          "Não foi possível atualizar seu estado de presença.",
        );
      }
    });
  }

  async function handleRandomizeAvatar() {
    const newSeed = generateRandomAvatarSeed();
    setLocalAvatarSeedOverride(newSeed);
    saveLocalAvatarSeed(newSeed);

    try {
      await updateAvatar(socket, newSeed);
    } catch (err) {
      console.error("Falha ao atualizar avatar:", err);
    }
  }

  function confirmKick(participantId: string) {
    setParticipantActionError("");
    socket.emit("room:kick", { participantId }, (result) => {
      if (!result.ok) {
        setParticipantActionError(
          result.error === "NOT_HOST"
            ? "Somente o host pode remover participantes."
            : "Não foi possível remover esse participante.",
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
    if (!(await onPrepareSource(sourceId, includeSystemAudio))) {
      setSelectedSourceId(null);
    }
  }

  function closeSourcePicker() {
    setSelectedSourceId(null);
    void onPrepareSource(null, includeSystemAudio);
    setIsSourcePickerOpen(false);
  }

  async function handleStartCapture() {
    if (
      !selectedSourceId ||
      preparedSourceId !== selectedSourceId ||
      isStartingCapture ||
      isStartingLocally
    ) {
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
    socket.emit("room:leave", () => onLeave());
  }

  return (
    <main className="relative flex h-full min-h-full flex-col overflow-x-hidden bg-background text-slate-50 lg:h-full lg:flex-row lg:overflow-hidden">
      {/* Overlay sutil ao fundo para garantir efeito premium */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--primary)/0.08),transparent_55%)]"
      />

      {/* Barra lateral com efeito glass refinado */}
      <aside
        style={{
          ["--sidebar-width" as string]: `${sidebarWidth}px`,
        }}
        className={`relative z-10 flex w-full shrink-0 flex-col border-b border-border/40 bg-slate-950/70 backdrop-blur-xl p-4 sm:p-5 lg:h-screen lg:min-h-0 lg:w-[var(--sidebar-width)] lg:border-b-0 lg:border-r shadow-lg ${
          isResizing
            ? "transition-none select-none"
            : "transition-[width] duration-150 ease-out"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-border/40 pb-4 [-webkit-app-region:drag]">
          <div className="grid h-10 w-10 place-items-center rounded-xl  text-primary">
            <img
              src="./images/logo.png"
              alt="TopCast"
              className="h-10 w-10 rounded-xl border border-primary/20 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-normal tracking-tight text-slate-100">
              TopCast
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">Sala de transmissão</p>
          </div>
        </div>

        {/* Card do Convite */}
        <section
          aria-label="Convite da sala"
          className="mt-3.5 rounded-xl border border-border/40 bg-slate-900/40 backdrop-blur-md p-3.5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Convite
            </h2>
            <span className="text-[11px] font-medium text-slate-400">
              Expira em {formatRoomTimeRemaining(room.expiresAt, now)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-border/30 bg-slate-950/60 p-1.5 pl-2.5 shadow-inner">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-widest text-blue-200">
              {room.inviteCode}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleCopyCode()}
                  aria-label={
                    isCopied ? "Código copiado" : "Copiar código do convite"
                  }
                  className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isCopied ? "Copiado!" : "Copiar código de convite"}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Validade: {new Date(room.expiresAt).toLocaleString()}
          </p>
        </section>

        {/* Lista de Participantes */}
        <section
          aria-labelledby="participants-heading"
          className="mt-4 flex min-h-24 flex-1 flex-col lg:min-h-0"
        >
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h2
              id="participants-heading"
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              Participantes
            </h2>
            <span className="text-[12px] tabular-nums text-slate-400">
              {room.participants.length}/{room.maxParticipants}
            </span>
          </div>
          <ul className="mt-2.5 flex flex-col gap-1.5 overflow-y-auto pr-0.5">
            {room.participants.map((participant) => {
              const isSelf = participant.id === selfParticipantId;
              const presenceColor =
                participant.presence === "available"
                  ? "bg-emerald-400"
                  : participant.presence === "away"
                    ? "bg-amber-300"
                    : "bg-red-400";
              const presenceLabel =
                participant.presence === "available"
                  ? "Online"
                  : participant.presence === "away"
                    ? "Ausente"
                    : "Ocupado";

              const canKickThisParticipant =
                isHost && !isSelf && participant.role !== "host";

              return (
                <li
                  key={participant.id}
                  onClick={() => {
                    if (canKickThisParticipant) {
                      setParticipantToKick({
                        id: participant.id,
                        displayName: participant.displayName,
                      });
                    }
                  }}
                  className={`group flex items-center justify-between gap-2.5 rounded-xl border border-border/30 bg-slate-900/40 backdrop-blur-sm p-2.5 transition-all duration-150 ${
                    canKickThisParticipant
                      ? "cursor-pointer hover:border-border/60 hover:bg-slate-800/70"
                      : ""
                  }`}
                  role={canKickThisParticipant ? "button" : undefined}
                  tabIndex={canKickThisParticipant ? 0 : undefined}
                  onKeyDown={
                    canKickThisParticipant
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setParticipantToKick({
                              id: participant.id,
                              displayName: participant.displayName,
                            });
                          }
                        }
                      : undefined
                  }
                  title={
                    canKickThisParticipant
                      ? `Clique para remover ${participant.displayName} da sala`
                      : undefined
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {/* Avatar com status badge */}
                    <div className="relative shrink-0">
                      <div
                        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-slate-950/80 ring-1 ring-border/50 shadow-sm"
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
                    {participant.role === "host" ? (
                      <span className="inline-flex items-center gap-1 rounded-sm border  bg-amber-500 px-2 py-0.5 text-[11px] font-normal text-black">
                        <Crown className="h-3 w-3" />
                        Host
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
            <p
              role="alert"
              className="mt-2.5 inline-flex w-fit max-w-full self-start items-start gap-2 break-words rounded-xl border border-red-500/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200"
            >
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {participantActionError}
            </p>
          )}
        </section>

        {/* Status da Conexão & Áudio */}
        <div className="relative z-40 mt-4 border-t border-border/40 pt-3 lg:mt-3">
          <section
            aria-label="Status da conexão e transmissão"
            className="relative z-40 rounded-xl border border-border/40 bg-slate-900/50 backdrop-blur-md p-3.5 shadow-sm"
          >
            {/* Linha 2: Áudio da Tela & Botão de Efeitos de Áudio */}
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition-colors ${
                    hasSystemAudio && systemAudioEnabled
                      ? "border-blue-500/20 bg-blue-500/15 text-blue-400"
                      : "border-border/30 bg-slate-950/70 text-slate-500"
                  }`}
                >
                  {hasSystemAudio && systemAudioEnabled ? (
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
                    {!hasSystemAudio
                      ? "Nenhum som transmitido"
                      : systemAudioEnabled
                        ? "Transmitindo som"
                        : "Áudio mutado"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Botão de Efeitos de Áudio */}
                <AudioEffectsDialog />

                {/* Botão de Top Sounds (Soundboard) que abre para CIMA e para a DIREITA */}
                <TopSoundsDropdown placement="top-right" />

                {isHost && hasSystemAudio && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={
                          systemAudioEnabled
                            ? "Desativar áudio da transmissão"
                            : "Ativar áudio da transmissão"
                        }
                        onClick={() => onToggleSystemAudio(!systemAudioEnabled)}
                        className={`h-8 px-2.5 text-xs font-medium gap-1.5 rounded-xl border border-border/40 transition-all ${
                          systemAudioEnabled
                            ? "bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                            : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        }`}
                      >
                        {systemAudioEnabled ? (
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
                      {systemAudioEnabled
                        ? "Mutar o som transmitido"
                        : "Transmitir o som da tela"}
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
                  participant.presence === "available"
                    ? "bg-emerald-400"
                    : participant.presence === "away"
                      ? "bg-amber-400"
                      : "bg-red-400";
                const presenceLabel =
                  participant.presence === "available"
                    ? "Disponível"
                    : participant.presence === "away"
                      ? "Ausente"
                      : "Ocupado";

                return (
                  <div
                    key={participant.id}
                    onMouseEnter={handlePresenceMouseEnter}
                    onMouseLeave={handlePresenceMouseLeave}
                    className="relative"
                  >
                    {/* Botão Card do Perfil */}
                    <button
                      type="button"
                      onClick={() => setPresenceSelectOpen((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={presenceSelectOpen}
                      aria-label={`Alterar status de ${participant.displayName}. Status atual: ${presenceLabel}`}
                      className="group flex w-full items-center gap-2.5 rounded-xl border border-border/40 bg-slate-900/50 p-2 shadow-sm backdrop-blur-md transition-all duration-150 hover:border-border/70 hover:bg-slate-900/80 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="relative shrink-0" aria-hidden="true">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-slate-950/80 ring-1 ring-border/50 shadow-sm">
                          <VoxelAvatar
                            displayName={participant.displayName}
                            seed={
                              localAvatarSeedOverride || participant.avatarSeed
                            }
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
                            presenceSelectOpen
                              ? "rotate-180 text-primary"
                              : "rotate-0"
                          }`}
                        />
                      </span>
                    </button>

                    {/* Dropdown Menu com Glass styling */}
                    <div
                      className={`absolute bottom-full left-0 right-0 z-50 pb-2 transition-all duration-150 ease-out ${
                        presenceSelectOpen
                          ? "pointer-events-auto opacity-100 translate-y-0"
                          : "pointer-events-none opacity-0 translate-y-1"
                      }`}
                      role="listbox"
                      aria-label="Opções de status de presença e avatar"
                    >
                      <div className="flex flex-col gap-1 overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl">
                        {/* Miniatura da foto de perfil e randomizador simples */}
                        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-border/40 bg-slate-950/60 p-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-slate-900 shadow-inner">
                              <VoxelAvatar
                                displayName={participant.displayName}
                                seed={
                                  localAvatarSeedOverride ||
                                  participant.avatarSeed
                                }
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

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleRandomizeAvatar();
                                }}
                                aria-label="Sortear outro avatar"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-slate-900 text-slate-400 shadow-sm transition-colors duration-150 hover:border-border/80 hover:bg-slate-800 hover:text-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                <Dice5 className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Sortear avatar
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Divisória sutil */}
                        <div className="my-1 border-t border-border/40" />
                        {[
                          {
                            value: "available",
                            label: "Disponível",
                            dotColor: "bg-emerald-400",
                          },
                          {
                            value: "away",
                            label: "Ausente",
                            dotColor: "bg-amber-400",
                          },
                          {
                            value: "busy",
                            label: "Ocupado",
                            dotColor: "bg-red-400",
                          },
                        ].map((option) => {
                          const isSelected =
                            participant.presence === option.value;
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
                                  ? "bg-slate-800 text-white font-semibold shadow-sm"
                                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                              }`}
                            >
                              <span className="flex items-center gap-2.5">
                                <span
                                  className={`h-2 w-2 rounded-full ${option.dotColor}`}
                                />
                                <span>{option.label}</span>
                              </span>
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 text-blue-400" />
                              )}
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
              className="group absolute -right-1.5 top-0 bottom-0 z-20 hidden w-3 cursor-col-resize select-none touch-none lg:block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <div
                className={`mx-auto h-full w-[2px] transition-colors duration-150 ${
                  isResizing
                    ? "bg-primary"
                    : "bg-transparent group-hover:bg-primary/50 group-focus-visible:bg-primary"
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
      <div className="relative mx-auto flex min-h-full w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:min-h-0 lg:px-6 lg:py-5">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/40 pb-4 [-webkit-app-region:drag]">
          <div>
            <h2 className="text-base  tracking-tighter text-slate-100">
              Sala de transmissão
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isHost
                ? "Compartilhe sua tela com a sala"
                : "Acompanhe a transmissão"}
            </p>
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
                <TooltipContent side="bottom">
                  Guia de Boas-Vindas
                </TooltipContent>
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
                        className="h-9 gap-2 rounded-xl  bg-red-600 px-3.5 text-xs font-medium text-white/85 shadow-sm transition-all  hover:bg-red-600/50 hover:text-white-200"
                      >
                        <LogOut className="h-4 w-4" />
                        {isLeaving ? "Encerrando…" : "Encerrar sala"}
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Encerrar sala para todos os participantes
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent className="max-w-md overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-0 text-slate-100 shadow-2xl backdrop-blur-xl sm:max-w-md">
                  {/* Luz ambiente superior suave */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-24 left-1/2 h-48 w-full -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/15 via-red-500/5 to-transparent blur-2xl"
                  />

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
                      Todos os participantes conectados serão desconectados
                      imediatamente e o código de convite deixará de funcionar.
                    </p>
                    <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span>
                        Esta ação é definitiva e encerrará a transmissão no
                        servidor para todos os membros.
                      </span>
                    </div>
                  </div>

                  {/* Footer padronizado com os botões do sistema */}
                  <div className="relative z-10 flex flex-col-reverse gap-2.5 border-t border-border/40 bg-slate-950/40 px-6 py-4 sm:flex-row sm:justify-end">
                    <AlertDialogCancel className="w-full sm:w-auto h-9 rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-primary">
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
                    {isLeaving ? "Saindo…" : "Sair da sala"}
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
        <div className="flex flex-1 flex-col gap-4 py-4 lg:min-h-0 lg:py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
            <section
              className={`relative flex flex-col items-center justify-center transition-all duration-150 ${
                isStreamFullscreen
                  ? "fixed inset-0 z-[100] h-screen w-screen bg-black p-0 rounded-none border-none overflow-hidden"
                  : "min-h-[340px] flex-1 overflow-hidden rounded-2xl border border-border/40 bg-slate-900/50 backdrop-blur-md p-4 shadow-md sm:min-h-[420px] sm:p-5 lg:min-h-0"
              }`}
            >
              {presentationStream && isReceivingVideo ? (
                <>
                  {!isStreamFullscreen && (
                    <div className="mb-3.5 flex w-full items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                        </span>
                        <span>
                          {isHost
                            ? "Sua tela está sendo compartilhada"
                            : `${host?.displayName ?? "Host"} está compartilhando`}
                        </span>
                      </div>
                      {isHost && (
                        <div className="flex items-center gap-2">
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
                              Alterar a tela ou janela transmitida sem
                              interromper a transmissão
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={onStopCapture}
                                className="h-9 gap-2 rounded-xl  bg-red-600 px-3.5 text-xs font-medium text-white/85 shadow-sm transition-all  hover:bg-red-600/50 hover:text-white-200"
                              >
                                <StopCircle className="h-3.5 w-3.5" />
                                <span>Parar compartilhamento</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Interromper transmissão da sua tela
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={
                      isStreamFullscreen
                        ? "relative h-full w-full bg-black overflow-hidden"
                        : "aspect-video w-full overflow-hidden rounded-xl border border-border/30 bg-black shadow-inner"
                    }
                  >
                    <StreamVideo stream={presentationStream} isHost={isHost} />
                  </div>
                </>
              ) : (
                <div className="relative flex w-full flex-col items-center justify-center py-6 text-center">
                  {/* Iluminação ambiente e grade de fundo sutil */}

                  {/* Ícone principal com acabamento refinado */}
                  <div className="relative mb-4">
                    <div className="grid h-20 w-20 place-items-center ">
                      <Strands
                        className="h-full w-full"
                        interactive={true}
                        clickPulse={true}
                      />
                    </div>
                  </div>

                  <div className="relative mt-2.5 max-w-lg text-center text-sm leading-relaxed text-slate-400">
                    {isHost
                      ? "Transmita monitores inteiros ou janelas específicas com áudio em alta definição e latência ultrabaixa para todos na sala."
                      : "O host ainda não iniciou a transmissão. O vídeo da tela aparecerá automaticamente aqui assim que ele começar."}
                  </div>

                  {/* Botão de ação (Host) ou indicador de espera (Viewer) */}
                  {isHost ? (
                    <div className="relative mt-7">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="lg"
                            onClick={openSourcePicker}
                            className="h-11 gap-2.5 rounded-xl bg-primary px-6 text-sm font-normal text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-primary/35 active:scale-[0.98] focus-visible:ring-primary"
                          >
                            <Monitor className="h-4 w-4" />
                            <span>Compartilhar tela</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Selecionar tela ou janela para transmitir
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="relative mt-7 inline-flex items-center gap-2 rounded-xl border border-border/40 bg-slate-950/50 px-4 py-2 text-xs text-slate-400 shadow-sm backdrop-blur-md">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                      </span>
                      <span>
                        Conectado à sala &middot; Sincronizando transmissão
                      </span>
                    </div>
                  )}
                </div>
              )}

              {captureError && isHost && !isSourcePickerOpen && (
                <p
                  role="alert"
                  className="mx-auto mt-4 inline-flex w-fit max-w-full items-start gap-2 break-words rounded-xl border border-red-500/20 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-200"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  {captureError}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Tela / Janela com Glass Styling */}
      <Dialog
        open={isSourcePickerOpen}
        onOpenChange={(open) => !open && closeSourcePicker()}
      >
        <DialogContent className="flex max-h-[88vh] w-full max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-0 text-slate-100 shadow-2xl backdrop-blur-xl sm:max-w-4xl">
          <DialogHeader className="border-b border-border/40 px-6 py-5 text-left">
            <div className="flex items-center gap-3.5 pr-8">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <Monitor className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  {presentationStream
                    ? "Alterar tela de transmissão"
                    : "Escolha o que compartilhar"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-slate-400 sm:text-sm">
                  {presentationStream
                    ? "Selecione uma nova tela ou janela para transmitir sem interromper a transmissão."
                    : "Selecione uma tela inteira ou janela de aplicativo para transmitir à sala."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-slate-950/40 px-6 py-3">
            <div
              role="tablist"
              aria-label="Tipo de origem"
              className="inline-flex rounded-xl border border-border/40 bg-slate-950/70 p-1"
            >
              {(["screen", "window"] as const).map((kind) => {
                const isScreen = kind === "screen";
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
                    className={`inline-flex h-8 items-center gap-2 rounded-lg px-3.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                  >
                    <SourceIcon className="h-3.5 w-3.5" />
                    {isScreen ? "Telas" : "Janelas"}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-slate-500">
                {filteredSources.length}{" "}
                {sourceKind === "screen"
                  ? filteredSources.length === 1
                    ? "tela disponível"
                    : "telas disponíveis"
                  : filteredSources.length === 1
                    ? "janela disponível"
                    : "janelas disponíveis"}
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
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isLoadingSources ? "animate-spin" : ""}`}
                    />
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
              <p
                role="alert"
                className="mb-4 flex w-fit max-w-full items-start gap-2.5 break-words rounded-xl border border-red-500/20 bg-red-400/10 px-3.5 py-3 text-sm leading-5 text-red-200"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                {captureError}
              </p>
            )}

            {isLoadingSources && filteredSources.length === 0 && (
              <div
                role="status"
                className="flex min-h-64 flex-col items-center justify-center text-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-border/40 bg-slate-800/70 text-blue-300">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                </span>
                <p className="mt-4 text-sm font-medium text-slate-200">
                  Buscando {sourceKind === "screen" ? "telas" : "janelas"}…
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Identificando janelas e monitores ativos no sistema.
                </p>
              </div>
            )}

            {!isLoadingSources && filteredSources.length === 0 && (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-border/40 bg-slate-950/30 px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-border/40 bg-slate-800/70 text-slate-400">
                  {sourceKind === "screen" ? (
                    <Monitor className="h-5 w-5" />
                  ) : (
                    <AppWindow className="h-5 w-5" />
                  )}
                </span>
                <p className="mt-4 text-sm font-medium text-slate-200">
                  Nenhuma {sourceKind === "screen" ? "tela" : "janela"}{" "}
                  encontrada
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                  Certifique-se de que a janela desejada não está minimizada e
                  tente atualizar a lista.
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
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                          : "border-border/40 bg-slate-950/60 backdrop-blur-sm hover:border-primary/50 hover:bg-slate-900/60"
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                        <SourceThumbnail
                          source={source}
                          sourceKind={sourceKind}
                        />
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

          <div className="flex flex-col-reverse gap-3 border-t border-border/40 bg-slate-950/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="self-center text-xs text-slate-500">
              Qualidade inicial: até 720p · 30 FPS
            </p>
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
                    <span>
                      {presentationStream ? "Alterando…" : "Iniciando…"}
                    </span>
                  </>
                ) : (
                  <>
                    {presentationStream ? (
                      <RefreshCw className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )}
                    <span>
                      {presentationStream ? "Alterar tela" : "Compartilhar"}
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de expulsão de participante com AlertDialog */}
      <AlertDialog
        open={Boolean(participantToKick)}
        onOpenChange={(open) => !open && setParticipantToKick(null)}
      >
        <AlertDialogContent className="max-w-md overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-0 text-slate-100 shadow-2xl backdrop-blur-xl sm:max-w-md">
          {/* Luz ambiente superior suave */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-48 w-full -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-500/15 via-red-500/5 to-transparent blur-2xl"
          />

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
              Tem certeza que deseja remover{" "}
              <strong className="font-semibold text-slate-100">
                {participantToKick?.displayName}
              </strong>{" "}
              da transmissão? O participante será desconectado imediatamente.
            </p>
          </div>

          {/* Footer com botões padronizados */}
          <div className="relative z-10 flex flex-col-reverse gap-2.5 border-t border-border/40 bg-slate-950/40 px-6 py-4 sm:flex-row sm:justify-end">
            <AlertDialogCancel
              onClick={() => setParticipantToKick(null)}
              className="w-full sm:w-auto h-9 rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-primary"
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
          role={toastTone === "error" ? "alert" : "status"}
          aria-live={toastTone === "error" ? "assertive" : "polite"}
          className={`fixed right-4 top-4 z-[90] flex w-fit max-w-[min(24rem,calc(100vw-2rem))] items-start gap-2.5 break-words rounded-xl border border-border/40 bg-slate-900/90 px-4 py-3 text-sm shadow-xl backdrop-blur-xl sm:right-6 sm:top-6 ${
            toastTone === "error"
              ? "text-red-100 shadow-red-950/20"
              : "text-slate-100"
          }`}
        >
          {toastTone === "error" ? (
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
            />
          ) : (
            <Check
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
            />
          )}
          <span className="min-w-0">{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
