import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  CircleAlert,
  Copy,
  Globe,
  Radio,
  RotateCcw,
  Server,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { SettingsDialog } from '../components/settings-dialog';
import { APP_NAME } from '../../shared/constants/app';

const DEFAULT_SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://127.0.0.1:3001';

const appInfo = window.topCast?.getAppInfo() ?? {
  name: APP_NAME,
  version: '0.1.0 (TELEBOGAS)',
  electron: 'n/a',
  chrome: 'n/a',
};

function ScreenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ActionIcon({ action }: { action: 'create' | 'join' }) {
  if (action === 'create') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M4 12h12m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AnimatedWaveBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* 1. Iluminação Ambiente Tri-Tonal (Muted Purple, Primary Cobalt, Soft Mint) */}
      <div className="absolute -top-32 -left-20 h-[480px] w-[640px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08)_0%,transparent_65%)] blur-3xl" />
      <div className="animate-glow-pulse absolute -top-36 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.16)_0%,hsl(var(--primary-600)/0.05)_45%,transparent_70%)] blur-2xl" />
      <div className="absolute top-1/4 -right-24 h-[440px] w-[580px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.06)_0%,transparent_65%)] blur-3xl" />
      <div className="absolute -bottom-24 left-1/2 h-[450px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary-700)/0.07)_0%,transparent_65%)] blur-3xl" />

      {/* 2. Onda 1 (Profundidade & Camada de Fundo - Swell contínuo fluido) */}
      <div className="absolute bottom-0 left-0 h-64 sm:h-80 lg:h-96 w-full overflow-hidden opacity-80">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-1 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-wave-grad-1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.14" />
              <stop offset="45%" stopColor="hsl(var(--primary-700))" stopOpacity="0.08" />
              <stop offset="85%" stopColor="#1e1b4b" stopOpacity="0.03" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,140 C100,123 200,85 300,85 C400,85 500,123 600,140 C700,157 800,185 900,185 C1000,185 1100,157 1200,140 C1300,123 1400,85 1500,85 C1600,85 1700,123 1800,140 C1900,157 2000,185 2100,185 C2200,185 2300,157 2400,140 L2400,320 L0,320 Z"
            fill="url(#tc-wave-grad-1)"
            stroke="#a78bfa"
            strokeWidth="1.2"
            strokeOpacity="0.24"
          />
        </svg>
      </div>

      {/* 3. Onda 2 (Camada Intermediária - Contra-fluxo suave com Muted Purple e Cobalt) */}
      <div className="absolute bottom-0 left-0 h-56 sm:h-72 lg:h-88 w-full overflow-hidden opacity-75">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-2 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-wave-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.13" />
              <stop offset="35%" stopColor="hsl(var(--primary-500))" stopOpacity="0.09" />
              <stop offset="75%" stopColor="#0f172a" stopOpacity="0.03" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,175 C93,158 213,119 320,120 C427,121 533,163 640,180 C747,197 867,221 960,220 C1053,219 1107,192 1200,175 C1293,158 1413,119 1520,120 C1627,121 1733,163 1840,180 C1947,197 2067,221 2160,220 C2253,219 2307,192 2400,175 L2400,320 L0,320 Z"
            fill="url(#tc-wave-grad-2)"
            stroke="hsl(var(--primary-300))"
            strokeWidth="1.1"
            strokeOpacity="0.26"
          />
        </svg>
      </div>

      {/* 4. Onda 3 (Primeiro Plano - Fluxo orgânico com toque de Menta Luminosa) */}
      <div className="absolute bottom-0 left-0 h-48 sm:h-64 lg:h-76 w-full overflow-hidden opacity-90">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-3 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-wave-grad-3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.18" />
              <stop offset="25%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
              <stop offset="65%" stopColor="#8b5cf6" stopOpacity="0.05" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <path
            d="M0,210 C67,199 158,164 250,165 C342,166 450,213 550,215 C650,217 767,173 850,175 C933,178 992,224 1050,230 C1108,236 1133,221 1200,210 C1267,199 1358,164 1450,165 C1542,166 1650,213 1750,215 C1850,217 1967,173 2050,175 C2133,178 2192,224 2250,230 C2308,236 2333,221 2400,210 L2400,320 L0,320 Z"
            fill="url(#tc-wave-grad-3)"
            stroke="#5eead4"
            strokeWidth="1.2"
            strokeOpacity="0.38"
          />
        </svg>
      </div>

      {/* 5. Overlays de contraste & proteção visual do conteúdo da Home */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_30%,hsl(var(--background))_92%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/75" />
      <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--primary))_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.035]" />
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

  const isConnected = roomIsActive !== null;
  const isCustomUrl = signalingServerUrl !== DEFAULT_SIGNALING_URL;
  const isCurrentUrl = serverInput.trim() === signalingServerUrl;

  useEffect(() => setServerInput(signalingServerUrl), [signalingServerUrl]);

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
      setServerError(error instanceof Error
        ? error.message
        : 'Informe um endereço válido, como http://192.168.1.20:3001.');
    }
  }

  return (
    <main className="relative flex h-full min-h-full items-center justify-center overflow-x-hidden bg-[#0b1020] px-5 py-6 text-slate-50 sm:px-8 sm:py-8">
      <AnimatedWaveBackground />

      <div className="absolute right-4 top-4 z-20 [-webkit-app-region:no-drag] sm:right-6 sm:top-6">
        <SettingsDialog />
      </div>

      <div className="relative z-10 w-full max-w-[520px]">
        <header className="mb-12 flex items-center justify-center gap-3 [-webkit-app-region:drag]">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
            <ScreenIcon />
          </div>
          <span className="text-lg font-semibold tracking-tight">{appInfo.name}</span>
        </header>

        <section aria-labelledby="welcome-title" className="text-center">
          <p className="text-sm font-medium text-blue-300">Compartilhe o que importa</p>
          <h1 id="welcome-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Sua tela, em boa companhia.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-400 sm:text-base">
            Crie uma sala para transmitir ou entre usando um código de convite.
          </p>
        </section>

        <div className="mt-8">
          <label htmlFor="display-name" className="mb-2 block text-left text-sm font-medium text-slate-200">
            Nome de exibição
          </label>
          <input
            id="display-name"
            type="text"
            autoComplete="nickname"
            maxLength={32}
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.currentTarget.value)}
            placeholder="Como as pessoas devem chamar você?"
            className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15"
          />
          <p className="mt-2 text-xs text-slate-500">Sem conta ou cadastro. Seu nome fica salvo neste dispositivo.</p>
        </div>

        <section aria-label="Ações da sala" className="mt-9 grid gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block" tabIndex={roomIsActive ? 0 : undefined}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={roomIsActive !== false || displayName.trim().length === 0}
                    onClick={onCreateRoom}
                    className="group h-auto w-full justify-between rounded-2xl border-slate-800 bg-slate-900/70 px-5 py-4 text-left text-slate-100 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-400/50 hover:bg-slate-900 focus-visible:ring-blue-400"
                  >
                    <span className="flex items-center gap-4">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/10 text-blue-300 transition-colors group-hover:bg-blue-500/15">
                        <ActionIcon action="create" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">Criar sala</span>
                        <span className="mt-1 block text-xs font-normal text-slate-400">Inicie uma nova transmissão</span>
                      </span>
                    </span>
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300">
                      <path d="m7.5 4.5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {roomIsActive
                  ? 'Já existe uma sala ativa no momento'
                  : roomIsActive === null
                    ? 'Conectando ao servidor de salas'
                    : 'Informe um nome de exibição para criar uma sala'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            type="button"
            variant="outline"
            disabled={displayName.trim().length === 0}
            onClick={onJoinRoom}
            className="group h-auto w-full justify-between rounded-2xl border-slate-800 bg-slate-900/70 px-5 py-4 text-left text-slate-100 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900 focus-visible:ring-blue-400"
          >
            <span className="flex items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-800 text-slate-300 transition-colors group-hover:bg-slate-700">
                <ActionIcon action="join" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Entrar com código</span>
                <span className="mt-1 block text-xs font-normal text-slate-400">Conecte-se a uma sala existente</span>
              </span>
            </span>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300">
              <path d="m7.5 4.5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </section>

        {/* Seção Servidor de Salas */}
        <section
          aria-labelledby="server-section-title"
          className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 shadow-lg shadow-black/20 backdrop-blur-sm"
        >
          {/* Header com ícone, título e status online/conectando */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                isConnected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300 animate-pulse'
              }`}>
                <Server className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 id="server-section-title" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Servidor de Salas
                </h2>
                <p className="truncate text-xs text-slate-400">
                  {isConnected ? 'Sinalização pronta para conexões' : 'Tentando estabelecer conexão…'}
                </p>
              </div>
            </div>

            {/* Badge de status */}
            <div className="flex shrink-0 items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                isConnected
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
              }`}>
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

          {/* Formulário com Input estilizado */}
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
                  className="h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 pl-9 pr-10 font-mono text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 sm:text-sm"
                />

                {/* Botão de copiar endereço ativo dentro do input */}
                <div className="absolute inset-y-0 right-1 flex items-center">
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
                </div>
              </div>

              {/* Botão de ação Aplicar / Conectar */}
              <Button
                type="submit"
                disabled={isCurrentUrl && !serverError}
                className={`h-10 shrink-0 gap-1.5 px-4 font-medium transition-all ${
                  isCurrentUrl && !serverError
                    ? 'border border-slate-800 bg-slate-800/50 text-slate-400'
                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20'
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

            {/* Mensagem de Erro de validação */}
            {serverError && (
              <p role="alert" className="mt-2.5 flex items-start gap-2 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs leading-5 text-red-200">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{serverError}</span>
              </p>
            )}

            {/* Rodapé com dicas de rede local e atalho para restaurar padrão */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                Para rede local, use o IP deste computador (ex: <code className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">192.168.1.x:3001</code>).
              </span>

              {/* Botão de Restaurar Padrão quando o servidor for customizado */}
              {isCustomUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleRestoreDefault}
                      className="inline-flex items-center gap-1.5 font-medium text-blue-400 hover:text-blue-300 hover:underline text-[11px]"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar padrão
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Redefinir para o servidor local padrão ({DEFAULT_SIGNALING_URL})
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </form>
        </section>

        {notice && (
          <p role="status" className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-center text-sm text-amber-100">
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
