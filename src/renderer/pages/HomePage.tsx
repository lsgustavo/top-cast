import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  Globe,
  Radio,
  RotateCcw,
  Server,
  Users,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { AvatarPickerDialog } from '../components/avatar-picker-dialog';
import { SettingsDialog } from '../components/settings-dialog';
import { VoxelAvatar } from '../components/voxel-avatar';
import {
  getOrCreateLocalAvatarSeed,
  saveLocalAvatarSeed,
} from '../lib/voxel-avatar';
import { APP_NAME } from '../../shared/constants/app';

const DEFAULT_SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://127.0.0.1:3001';

const appInfo = window.topCast?.getAppInfo() ?? {
  name: APP_NAME,
  version: '0.1.0',
  electron: 'n/a',
  chrome: 'n/a',
};

function AnimatedWaveBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* 1. Iluminação Ambiente Discreta e Profissional (sem brilhos excessivos) */}
      <div className="absolute -top-32 -left-20 h-[480px] w-[640px] rounded-full bg-[radial-gradient(ellipse_at_center,var(--glow-accent-1)_0%,transparent_65%)] blur-3xl opacity-50" />
      <div className="animate-glow-pulse absolute -top-36 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12)_0%,hsl(var(--primary-600)/0.03)_45%,transparent_70%)] blur-2xl opacity-60" />
      <div className="absolute top-1/4 -right-24 h-[440px] w-[580px] rounded-full bg-[radial-gradient(ellipse_at_center,var(--glow-accent-2)_0%,transparent_65%)] blur-3xl opacity-40" />
      <div className="absolute -bottom-24 left-1/2 h-[450px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary-700)/0.05)_0%,transparent_65%)] blur-3xl opacity-50" />

      {/* 2. Onda 1 (Profundidade & Camada de Fundo - Swell contínuo fluido) */}
      <div className="absolute bottom-0 left-0 h-64 sm:h-80 lg:h-96 w-full overflow-hidden opacity-70">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-1 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-wave-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wave-1-color)" stopOpacity="0.12" />
              <stop offset="45%" stopColor="hsl(var(--primary-700))" stopOpacity="0.06" />
              <stop offset="85%" stopColor="var(--wave-1-deep)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,140 C100,123 200,85 300,85 C400,85 500,123 600,140 C700,157 800,185 900,185 C1000,185 1100,157 1200,140 C1300,123 1400,85 1500,85 C1600,85 1700,123 1800,140 C1900,157 2000,185 2100,185 C2200,185 2300,157 2400,140 L2400,320 L0,320 Z"
            fill="url(#tc-wave-grad-1)"
            stroke="var(--wave-1-stroke)"
            strokeWidth="1.2"
            strokeOpacity="0.22"
          />
        </svg>
      </div>

      {/* 3. Onda 2 (Camada Intermediária - Contra-fluxo suave com tom médio) */}
      <div className="absolute bottom-0 left-0 h-56 sm:h-72 lg:h-88 w-full overflow-hidden opacity-65">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-2 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-wave-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wave-2-color)" stopOpacity="0.11" />
              <stop offset="35%" stopColor="hsl(var(--primary-500))" stopOpacity="0.07" />
              <stop offset="75%" stopColor="hsl(var(--background))" stopOpacity="0.02" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,175 C93,158 213,119 320,120 C427,121 533,163 640,180 C747,197 867,221 960,220 C1053,219 1107,192 1200,175 C1293,158 1413,119 1520,120 C1627,121 1733,163 1840,180 C1947,197 2067,221 2160,220 C2253,219 2307,192 2400,175 L2400,320 L0,320 Z"
            fill="url(#tc-wave-grad-2)"
            stroke="var(--wave-2-stroke)"
            strokeWidth="1.1"
            strokeOpacity="0.24"
          />
        </svg>
      </div>

      {/* 4. Onda 3 (Primeiro Plano - Destaque luminoso acolhedor) */}
      <div className="absolute bottom-0 left-0 h-48 sm:h-64 lg:h-76 w-full overflow-hidden opacity-80">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-3 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-wave-grad-3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--wave-3-color)" stopOpacity="0.14" />
              <stop offset="25%" stopColor="hsl(var(--primary))" stopOpacity="0.09" />
              <stop offset="65%" stopColor="var(--wave-3-mid)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <path
            d="M0,210 C67,199 158,164 250,165 C342,166 450,213 550,215 C650,217 767,173 850,175 C933,178 992,224 1050,230 C1108,236 1133,221 1200,210 C1267,199 1358,164 1450,165 C1542,166 1650,213 1750,215 C1850,217 1967,173 2050,175 C2133,178 2192,224 2250,230 C2308,236 2333,221 2400,210 L2400,320 L0,320 Z"
            fill="url(#tc-wave-grad-3)"
            stroke="var(--wave-3-stroke)"
            strokeWidth="1.2"
            strokeOpacity="0.28"
          />
        </svg>
      </div>

      {/* 5. Overlays de contraste & proteção visual do conteúdo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_35%,hsl(var(--background))_92%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/80" />
      <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--primary))_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.025]" />
    </div>
  );
}

interface HomePageProps {
  notice: string;
  signalingServerUrl: string;
  displayName: string;
  roomIsActive: boolean | null;
  onDisplayNameChange: (name: string) => void;
  onApplySignalingServer: (url: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export default function HomePage({
  notice,
  signalingServerUrl,
  displayName,
  roomIsActive,
  onDisplayNameChange,
  onApplySignalingServer,
  onCreateRoom,
  onJoinRoom,
}: HomePageProps) {
  const [serverInput, setServerInput] = useState(signalingServerUrl);
  const [serverError, setServerError] = useState('');
  const [isCopiedServerUrl, setIsCopiedServerUrl] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(() => getOrCreateLocalAvatarSeed());

  const isConnected = roomIsActive !== null;
  const isCustomUrl = signalingServerUrl !== DEFAULT_SIGNALING_URL;
  const isCurrentUrl = serverInput.trim() === signalingServerUrl;

  useEffect(() => setServerInput(signalingServerUrl), [signalingServerUrl]);

  useEffect(() => {
    const handleUserSettingsUpdated = (e: Event) => {
      const custom = e as CustomEvent<{
        avatarSeed?: string;
        displayName?: string;
      }>;
      if (custom.detail?.avatarSeed) {
        setAvatarSeed(custom.detail.avatarSeed);
      }
      if (typeof custom.detail?.displayName === 'string') {
        onDisplayNameChange(custom.detail.displayName);
      }
    };
    window.addEventListener('topcast:user-settings-updated', handleUserSettingsUpdated);
    return () => {
      window.removeEventListener('topcast:user-settings-updated', handleUserSettingsUpdated);
    };
  }, [onDisplayNameChange]);

  function handleSelectAvatar(nextSeed: string) {
    saveLocalAvatarSeed(nextSeed);
    setAvatarSeed(nextSeed);
  }

  async function handleCopyServerUrl() {
    try {
      if (window.topCast?.copyToClipboard) {
        await window.topCast.copyToClipboard(signalingServerUrl);
      } else if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(signalingServerUrl);
      }
      setIsCopiedServerUrl(true);
      window.setTimeout(() => setIsCopiedServerUrl(false), 2000);
    } catch {
      // ignore
    }
  }

  function handleRestoreDefault() {
    setServerInput(DEFAULT_SIGNALING_URL);
    setServerError('');
    onApplySignalingServer(DEFAULT_SIGNALING_URL);
  }

  function handleServerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let trimmed = serverInput.trim();
    if (!trimmed) {
      setServerError('Informe um endereço de servidor.');
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `http://${trimmed}`;
    }
    try {
      const url = new URL(trimmed);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        (url.pathname !== '/' && url.pathname !== '') ||
        url.search ||
        url.hash
      ) {
        throw new Error('Informe um endereço HTTP(S) com host e porta (ex: http://192.168.1.20:3001).');
      }
      setServerError('');
      setServerInput(url.origin);
      onApplySignalingServer(url.origin);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Informe um endereço válido, como http://192.168.1.20:3001.',
      );
    }
  }

  return (
    <main className="relative flex h-full min-h-full flex-col items-center justify-start overflow-x-hidden overflow-y-auto bg-background px-5 py-8 text-slate-50 sm:px-8 sm:py-12">
      <AnimatedWaveBackground />

      {/* Botão de Configurações com Glass Effect */}
      <div className="absolute right-4 top-4 z-20 [-webkit-app-region:no-drag] sm:right-6 sm:top-6">
        <SettingsDialog />
      </div>

      <div className="relative z-10 my-auto w-full max-w-[520px]">
        {/* Identidade do App */}
        <header className="mb-6 flex items-center justify-center gap-2.5 [-webkit-app-region:drag]">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
            <Radio className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">{appInfo.name}</span>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Beta
          </span>
        </header>

        {/* Hero Section */}
        <section aria-labelledby="welcome-title" className="text-center">
          <h1 id="welcome-title" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sua tela ao vivo, <span className="bg-gradient-to-r from-blue-400 via-primary to-blue-200 bg-clip-text text-transparent">simples e fluida.</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-xs leading-relaxed text-slate-400 sm:text-sm">
            Transmissão ponto a ponto de baixa latência com áudio do sistema em tempo real.
          </p>
        </section>

        {/* Perfil do Usuário com Efeito Glass */}
        <div className="mt-7 rounded-2xl p-4 glass-surface-secondary">
          <label htmlFor="display-name" className="mb-2.5 block text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
            Seu Perfil
          </label>
          <div className="flex items-center gap-3">
            {/* Avatar DiceBear Voxel Art */}
            <div
              className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950/60 ring-1 ring-border/40"
              aria-label={`Avatar de ${displayName || 'Você'}`}
            >
              <VoxelAvatar displayName={displayName || 'Você'} seed={avatarSeed} />
            </div>

            {/* Botão de editar para escolher ou gerar novas opções de avatar */}
            <AvatarPickerDialog
              displayName={displayName || 'Você'}
              avatarSeed={avatarSeed}
              onSelectAvatar={handleSelectAvatar}
            />

            {/* Input do nome */}
            <div className="min-w-0 flex-1">
              <input
                id="display-name"
                type="text"
                autoComplete="nickname"
                maxLength={32}
                value={displayName}
                onChange={(event) => onDisplayNameChange(event.currentTarget.value)}
                placeholder="Como as pessoas devem chamar você?"
                className="h-11 w-full rounded-xl border border-border/30 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>
          </div>
          <p className="mt-2 text-left text-xs text-slate-400">
            Sem cadastro ou conta. Seu nome e avatar ficam salvos neste dispositivo.
          </p>
        </div>

        {/* Ações da sala */}
        <section aria-label="Ações da sala" className="mt-4 grid gap-3">
          {(() => {
            const isNameEmpty = displayName.trim().length === 0;
            const createRoomTooltipText = roomIsActive
              ? 'Já existe uma sala ativa no momento'
              : roomIsActive === null
                ? 'Conectando ao servidor de salas'
                : isNameEmpty
                  ? 'Informe um nome de exibição para criar uma sala'
                  : null;

            if (createRoomTooltipText) {
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block" tabIndex={0}>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={true}
                          className="group relative h-auto w-full justify-between rounded-2xl border border-border/30 bg-slate-900/40 p-4 text-left text-slate-100 shadow-sm backdrop-blur-md opacity-50 cursor-not-allowed"
                        >
                          <span className="flex items-center gap-3.5">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                              <Radio className="h-5 w-5" />
                            </span>
                            <span>
                              <span className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">Criar sala</span>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                  Host
                                </span>
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-400">
                                Inicie uma transmissão privada
                              </span>
                            </span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {createRoomTooltipText}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return (
              <Button
                type="button"
                variant="outline"
                disabled={false}
                onClick={onCreateRoom}
                className="group relative h-auto w-full justify-between rounded-2xl border border-border/30 bg-slate-900/40 p-4 text-left text-slate-100 shadow-sm backdrop-blur-md transition-all duration-150 hover:bg-slate-900/60 hover:border-border/50 focus-visible:ring-primary"
              >
                <span className="flex items-center gap-3.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <Radio className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">Criar sala</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Host
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Inicie uma transmissão privada
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150 group-hover:text-slate-300" />
              </Button>
            );
          })()}

          <Button
            type="button"
            variant="outline"
            disabled={displayName.trim().length === 0}
            onClick={onJoinRoom}
            className="group relative h-auto w-full justify-between rounded-2xl border border-border/30 bg-slate-900/40 p-4 text-left text-slate-100 shadow-sm backdrop-blur-md transition-all duration-150 hover:bg-slate-900/60 hover:border-border/50 focus-visible:ring-primary disabled:opacity-50"
          >
            <span className="flex items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900/70 text-slate-200 transition-colors group-hover:bg-slate-800 group-hover:text-white">
                <Users className="h-5 w-5" />
              </span>
              <span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Entrar com código</span>
                  <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    Convidado
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  Conecte-se a uma sala existente com código de 6 dígitos
                </span>
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150 group-hover:text-slate-300" />
          </Button>
        </section>

        {/* Seção Servidor de Salas com Glass Styling - Oculta quando já existe uma sala ativa */}
        {!roomIsActive && (
          <section
            aria-labelledby="server-section-title"
            className="mt-5 rounded-2xl border border-border/25 bg-slate-900/30 p-4 sm:p-5 shadow-sm backdrop-blur-sm"
          >
            {/* Header com status online/conectando */}
            <div className="flex items-center justify-between gap-3 border-b border-primary/15 pb-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-300 animate-pulse'
                  }`}
                >
                  <Server className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="server-section-title"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                  >
                    Servidor de Salas
                  </h2>
                  <p className="truncate text-xs text-slate-400">
                    {isConnected
                      ? 'Sinalização pronta para conexões'
                      : 'Tentando estabelecer conexão…'}
                  </p>
                </div>
              </div>

              {/* Badge de status */}
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {isConnected ? (
                      <>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </>
                    ) : (
                      <>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                      </>
                    )}
                  </span>
                  {isConnected ? 'Online' : 'Conectando'}
                </span>
              </div>
            </div>

            {/* Formulário com Input */}
            <form onSubmit={handleServerSubmit} className="mt-3.5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Globe className="h-4 w-4" />
                  </div>
                  <input
                    id="signaling-server"
                    type="text"
                    required
                    value={serverInput}
                    onChange={(event) => {
                      setServerInput(event.currentTarget.value);
                      if (serverError) setServerError('');
                    }}
                    placeholder="http://127.0.0.1:3001 ou http://192.168.1.x:3001"
                    autoComplete="url"
                    className="h-10 w-full rounded-xl bg-slate-900/70 pl-9 pr-10 font-mono text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-primary/20 sm:text-sm transition-colors"
                  />

                  {/* Botão de copiar endereço */}
                  <div className="absolute inset-y-0 right-1 flex items-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={handleCopyServerUrl}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                            aria-label="Copiar endereço do servidor"
                          >
                            {isCopiedServerUrl ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {isCopiedServerUrl ? 'Endereço copiado!' : 'Copiar endereço'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Botão Aplicar / Conectar */}
                <Button
                  type="submit"
                  disabled={isCurrentUrl && !serverError}
                  className={`h-10 shrink-0 gap-1.5 rounded-xl px-4 font-medium transition-all ${
                    isCurrentUrl && !serverError
                      ? 'bg-slate-800/60 text-slate-400'
                      : 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                  }`}
                >
                  {isCurrentUrl && !serverError ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Ativo</span>
                    </>
                  ) : (
                    <>
                      <Radio className="h-3.5 w-3.5" />
                      <span>Conectar</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Mensagem de Erro */}
              {serverError && (
                <p role="alert" className="mt-2.5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200 topcast-alert-animate">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>{serverError}</span>
                </p>
              )}

              {/* Rodapé com dicas */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  Para rede local, use o IP deste computador (ex: <code className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">192.168.1.x:3001</code>).
                </span>

                {isCustomUrl && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleRestoreDefault}
                          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline text-[11px]"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restaurar padrão
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Redefinir para o servidor local padrão ({DEFAULT_SIGNALING_URL})
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </form>
          </section>
        )}

        {notice && (
          <p role="status" className="mt-4 rounded-xl border border-amber-400/20 bg-amber-300/[0.05] px-4 py-3 text-center text-sm text-amber-100 topcast-alert-animate">
            {notice}
          </p>
        )}

        <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>{appInfo.name}</span>
          <span aria-hidden="true">·</span>
          <span>Versão Beta {appInfo.version}</span>
        </footer>
      </div>
    </main>
  );
}
