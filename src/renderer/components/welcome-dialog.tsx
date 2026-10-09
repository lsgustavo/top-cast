import { useState } from 'react';
import { ArrowRight, Check, Monitor, Users, Volume2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

export const WELCOME_DISMISSED_STORAGE_KEY = 'topcast:welcome-dismissed';

export function isWelcomeDismissed(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(WELCOME_DISMISSED_STORAGE_KEY) === 'true';
    }
  } catch {
    // ignore
  }
  return false;
}

export function setWelcomeDismissed(dismissed: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (dismissed) {
        window.localStorage.setItem(WELCOME_DISMISSED_STORAGE_KEY, 'true');
      } else {
        window.localStorage.removeItem(WELCOME_DISMISSED_STORAGE_KEY);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Ondas animadas fluidas de fundo do modal, com o mesmo efeito e física da tela inicial.
 */
function AnimatedModalWaves() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-44 overflow-hidden select-none"
    >
      {/* Camada 1: Fundo (Muted Purple / Deep Navy) - Onda contínua suave */}
      <div className="absolute bottom-0 left-0 h-36 w-full overflow-hidden opacity-30">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-1 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-modal-wave-1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
              <stop offset="50%" stopColor="hsl(var(--primary-700))" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,140 C100,123 200,85 300,85 C400,85 500,123 600,140 C700,157 800,185 900,185 C1000,185 1100,157 1200,140 C1300,123 1400,85 1500,85 C1600,85 1700,123 1800,140 C1900,157 2000,185 2100,185 C2200,185 2300,157 2400,140 L2400,320 L0,320 Z"
            fill="url(#tc-modal-wave-1)"
            stroke="#a78bfa"
            strokeWidth="1.2"
            strokeOpacity="0.35"
          />
        </svg>
      </div>

      {/* Camada 2: Intermediária (Muted Violet / Cobalt) - Contra-fluxo suave */}
      <div className="absolute bottom-0 left-0 h-32 w-full overflow-hidden opacity-30">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-2 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-modal-wave-2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
              <stop offset="40%" stopColor="hsl(var(--primary-500))" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,175 C93,158 213,119 320,120 C427,121 533,163 640,180 C747,197 867,221 960,220 C1053,219 1107,192 1200,175 C1293,158 1413,119 1520,120 C1627,121 1733,163 1840,180 C1947,197 2067,221 2160,220 C2253,219 2307,192 2400,175 L2400,320 L0,320 Z"
            fill="url(#tc-modal-wave-2)"
            stroke="hsl(var(--primary-300))"
            strokeWidth="1.1"
            strokeOpacity="0.35"
          />
        </svg>
      </div>

      {/* Camada 3: Primeiro Plano (Toque de Menta Luminosa) */}
      <div className="absolute bottom-0 left-0 h-28 w-full overflow-hidden opacity-35">
        <svg
          viewBox="0 0 2400 320"
          preserveAspectRatio="none"
          className="animate-wave-3 absolute bottom-0 left-0 h-full w-[200%]"
        >
          <defs>
            <linearGradient id="tc-modal-wave-3" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.4" />
              <stop offset="30%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M0,210 C67,199 158,164 250,165 C342,166 450,213 550,215 C650,217 767,173 850,175 C933,178 992,224 1050,230 C1108,236 1133,221 1200,210 C1267,199 1358,164 1450,165 C1542,166 1650,213 1750,215 C1850,217 1967,173 2050,175 C2133,178 2192,224 2250,230 C2308,236 2333,221 2400,210 L2400,320 L0,320 Z"
            fill="url(#tc-modal-wave-3)"
            stroke="#5eead4"
            strokeWidth="1.2"
            strokeOpacity="0.45"
          />
        </svg>
      </div>

      {/* Fade vertical sutil para não interferir na leitura */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-slate-900/60" />
    </div>
  );
}

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && dontShowAgain) {
      setWelcomeDismissed(true);
    }
    onOpenChange(nextOpen);
  }

  function handleDismiss() {
    if (dontShowAgain) {
      setWelcomeDismissed(true);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden border border-slate-800 bg-slate-900/95 p-0 text-slate-100 shadow-2xl shadow-black/80 backdrop-blur-xl sm:rounded-2xl">
        <div className="relative w-full overflow-hidden">
          {/* Ondas animadas fluidas de fundo rodando ativamente */}
          <AnimatedModalWaves />
          {/* Cabeçalho Shadcn profissional (sem mascote) */}
          <div className="relative z-10 border-b border-slate-800/80 px-6 pt-7 pb-5 sm:px-8">
            <DialogHeader className="text-left sm:text-left">
              {/* Título e Descrição */}
              <DialogTitle className="mt-2.5 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
                Sua sala foi criada com sucesso!
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs text-slate-400 sm:text-sm">
                Conexão estabelecida. Siga estes passos rápidos para configurar e começar sua transmissão no TopCast:
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Corpo com os 3 passos práticos em cards Shadcn */}
          <div className="relative z-10 px-6 py-5 sm:px-8">
            <div className="grid gap-3">
              {/* Passo 1: Compartilhe sua tela */}
              <div className="flex items-start gap-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/80">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300 shadow-sm">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-bold text-blue-300">
                      1
                    </span>
                    <h4 className="text-sm font-semibold text-slate-100">
                      Compartilhe sua tela
                    </h4>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Use o botão principal de transmissão para selecionar qualquer monitor, janela ou tela inteira com preview em tempo real.
                  </p>
                </div>
              </div>

              {/* Passo 2: Transmita o som do sistema */}
              <div className="flex items-start gap-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/80">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-300 shadow-sm">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-bold text-purple-300">
                      2
                    </span>
                    <h4 className="text-sm font-semibold text-slate-100">
                      Transmita o áudio do sistema
                    </h4>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Ative a captura de som integrada para transmitir o áudio de alta fidelidade dos seus jogos, vídeos ou aplicativos junto com o vídeo.
                  </p>
                </div>
              </div>

              {/* Passo 3: Convite instantâneo */}
              <div className="flex items-start gap-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/80">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-sm">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                      3
                    </span>
                    <h4 className="text-sm font-semibold text-slate-100">
                      Convide seus participantes
                    </h4>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Copie o código de convite de 6 dígitos no painel lateral para que seus amigos assistam à transmissão via conexão direta P2P.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé: SEM border-top para que apenas as waves fluidas apareçam ao fundo */}
          <div className="relative z-10 flex flex-col items-center justify-between gap-3 bg-transparent px-6 pb-6 pt-2 sm:flex-row sm:px-8">
            {/* Controle discreto de não mostrar novamente */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDontShowAgain(!dontShowAgain)}
                className="group flex items-center gap-2 text-xs text-slate-400 transition-colors hover:text-slate-200"
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded border transition-colors ${
                    dontShowAgain
                      ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                      : 'border-slate-700 bg-slate-900/80 group-hover:border-slate-600'
                  }`}
                >
                  {dontShowAgain && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <span>Não mostrar isso novamente</span>
              </button>
            </div>

            {/* CTA Principal em destaque verde-menta */}
            <Button
              type="button"
              onClick={handleDismiss}
              className="group h-10 w-full gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500 px-6 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/30 active:scale-[0.98] sm:w-auto"
            >
              <span>Vamos lá!</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
