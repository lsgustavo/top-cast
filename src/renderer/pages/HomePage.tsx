import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { APP_NAME } from '../../shared/constants/app';

const appInfo = window.topCast?.getAppInfo() ?? {
  name: APP_NAME,
  version: '0.1.0',
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

interface HomePageProps {
  notice: string;
  signalingServerUrl: string;
  onApplySignalingServer: (url: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export default function HomePage({
  notice,
  signalingServerUrl,
  onApplySignalingServer,
  onCreateRoom,
  onJoinRoom,
}: HomePageProps) {
  const [serverInput, setServerInput] = useState(signalingServerUrl);
  const [serverError, setServerError] = useState('');

  useEffect(() => setServerInput(signalingServerUrl), [signalingServerUrl]);

  function handleServerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const url = new URL(serverInput.trim());
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        throw new Error('Informe um endereço HTTP(S) com host e porta, sem caminho adicional.');
      }
      setServerError('');
      onApplySignalingServer(url.origin);
    } catch (error) {
      setServerError(error instanceof Error
        ? error.message
        : 'Informe um endereço válido, como http://192.168.1.20:3001.');
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1020] px-5 py-10 text-slate-50 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.13),transparent_48%)]" />

      <div className="relative w-full max-w-[520px]">
        <header className="mb-12 flex items-center justify-center gap-3">
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

        <section aria-label="Ações da sala" className="mt-9 grid gap-3">
          <Button
            type="button"
            variant="outline"
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

          <Button
            type="button"
            variant="outline"
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

        <form
          aria-label="Servidor de salas"
          onSubmit={handleServerSubmit}
          className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <label htmlFor="signaling-server" className="block text-xs font-medium text-slate-300">
            Endereço do servidor de salas
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="signaling-server"
              type="url"
              required
              value={serverInput}
              onChange={(event) => setServerInput(event.currentTarget.value)}
              placeholder="http://192.168.1.20:3001"
              autoComplete="url"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-400"
            />
            <Button type="submit" variant="secondary" size="sm">Aplicar</Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Para uma rede local, use o endereço IP do computador que executa o servidor.
          </p>
          {serverError && (
            <p role="alert" className="mt-2 text-xs text-red-200">{serverError}</p>
          )}
        </form>

        {notice && (
          <p role="status" className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-center text-sm text-amber-100">
            {notice}
          </p>
        )}

        <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span>{appInfo.name}</span>
          <span aria-hidden="true">·</span>
          <span>Versão {appInfo.version}</span>
        </footer>
      </div>
    </main>
  );
}
