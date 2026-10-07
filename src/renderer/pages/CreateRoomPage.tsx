import { Button } from '../components/ui/button';
import { APP_NAME } from '../../shared/constants/app';

interface CreateRoomPageProps {
  onBack: () => void;
}

function ScreenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ParticipantIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 20c.5-3.4 2.7-5.2 6.5-5.2s6 1.8 6.5 5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function CreateRoomPage({ onBack }: CreateRoomPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1020] px-5 py-6 text-slate-50 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.1),transparent_48%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
              <ScreenIcon />
            </div>
            <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          </div>
          <Button type="button" variant="ghost" onClick={onBack} className="text-slate-400 hover:text-slate-100">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mr-2 h-4 w-4">
              <path d="M15.5 10h-11m4 4-4-4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar
          </Button>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <section className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center shadow-xl shadow-black/10 sm:p-10">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-blue-400/15 bg-blue-500/10 text-blue-300">
              <ScreenIcon />
            </div>
            <span className="mt-6 rounded-full border border-blue-400/20 bg-blue-400/[0.07] px-3 py-1 text-xs font-medium text-blue-200">
              Prévia da sala
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Sua sala de transmissão</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              Quando o serviço de salas estiver conectado, o código de convite aparecerá aqui para você compartilhar.
            </p>

            <div className="mt-8 w-full max-w-sm rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Código de convite</p>
              <p className="mt-2 font-mono text-xl tracking-[0.2em] text-slate-600">Aguardando servidor</p>
            </div>

            <Button type="button" size="lg" disabled className="mt-6 min-w-48 bg-blue-600 text-white">
              Iniciar transmissão
            </Button>
            <p className="mt-3 text-xs text-slate-500">A transmissão será habilitada em uma etapa posterior.</p>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Participantes</h2>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">1 / 10</span>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-950/40 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-500/15 text-blue-200">
                  <ParticipantIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">Você</p>
                  <p className="mt-0.5 text-xs text-slate-500">Host da sala</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Conectado" />
              </div>

              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                Os participantes aparecerão aqui quando a sala estiver ativa.
              </p>
            </section>

            <section className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.04] p-4">
              <p className="text-xs font-semibold text-amber-100">Prévia de interface</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Nenhuma sala foi criada ainda. Códigos e participantes reais dependem do backend, implementado em etapas futuras.
              </p>
            </section>
          </aside>
        </div>

        <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-600">
          {APP_NAME} <span aria-hidden="true">·</span> Ambiente de desenvolvimento
        </footer>
      </div>
    </main>
  );
}
