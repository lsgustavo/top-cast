import * as React from 'react';
import { useState } from 'react';
import { AppWindow, Monitor } from 'lucide-react';
import type { CaptureSource } from '../../shared/types/desktop-api';

interface SourceThumbnailProps {
  source: CaptureSource;
  sourceKind: 'screen' | 'window';
}

/**
 * Placeholder criativo e profissional para janelas ou telas quando a pré-visualização não está disponível.
 */
export function SourceThumbnailPlaceholder({
  source,
  sourceKind,
}: SourceThumbnailProps) {
  const isWindow = sourceKind === 'window';

  return (
    <div
      aria-label={`Pré-visualização de ${source.name}`}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950 select-none"
    >
      {/* Grade de fundo sutil com padrão pontilhado estilo blueprint / design UI */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px] opacity-25"
      />

      {/* Iluminação ambiente suave */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 left-1/2 h-28 w-44 -translate-x-1/2 rounded-full bg-blue-500/10 blur-xl"
      />

      {/* Mockup visual estruturado de janela / monitor */}
      <div className="relative flex h-[78%] w-[86%] flex-col overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/90 shadow-xl shadow-black/50 backdrop-blur-sm transition-all duration-300 group-hover:border-slate-600 group-hover:bg-slate-900">
        {/* Barra superior de controle (Titlebar mockup) */}
        <div className="flex h-5 w-full shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-2.5">
          {/* Pontos de controle de janela (Traffic lights) */}
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
          </div>

          {/* Mini aba / título centralizado */}
          <div className="flex max-w-[62%] items-center gap-1 rounded bg-slate-900/90 px-2 py-0.5 border border-slate-800">
            {isWindow ? (
              <AppWindow className="h-2.5 w-2.5 text-slate-400 shrink-0" />
            ) : (
              <Monitor className="h-2.5 w-2.5 text-blue-400 shrink-0" />
            )}
            <span className="truncate text-[9px] font-medium text-slate-400">
              {source.name}
            </span>
          </div>

          <div className="w-5" />
        </div>

        {/* Área interna com ícone do app ou ilustração representativa */}
        <div className="relative flex flex-1 flex-col items-center justify-center p-2 text-center">
          {isWindow && source.appIconDataUrl ? (
            <div className="relative flex flex-col items-center">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700/80 bg-slate-800/90 p-2 shadow-md shadow-black/40 transition-transform group-hover:scale-105">
                <img
                  src={source.appIconDataUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[9px] font-medium text-slate-300">
                <span className="h-1 w-1 rounded-full bg-blue-400" />
                Janela Ativa
              </span>
            </div>
          ) : isWindow ? (
            <div className="flex flex-col items-center">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700/70 bg-slate-800/80 text-slate-300 shadow-md transition-transform group-hover:scale-105">
                <AppWindow className="h-5 w-5 text-slate-300" />
              </div>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[9px] font-medium text-slate-300">
                <span className="h-1 w-1 rounded-full bg-blue-400" />
                Janela / Aba
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300 shadow-md transition-transform group-hover:scale-105">
                <Monitor className="h-5 w-5" />
              </div>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-300">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                Tela Inteira
              </span>
            </div>
          )}

          {/* Guias sutis de interface no rodapé da janela mockup */}
          <div className="pointer-events-none absolute inset-x-3 bottom-1.5 flex items-center justify-between opacity-25">
            <span className="h-0.5 w-7 rounded-full bg-slate-600" />
            <span className="h-0.5 w-11 rounded-full bg-slate-600" />
            <span className="h-0.5 w-5 rounded-full bg-slate-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renderiza o thumbnail da fonte ou aciona o placeholder caso a imagem esteja ausente ou falhe ao carregar.
 */
export function SourceThumbnail({ source, sourceKind }: SourceThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  if (source.thumbnailDataUrl && !hasError) {
    return (
      <img
        src={source.thumbnailDataUrl}
        alt={source.name}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    );
  }

  return <SourceThumbnailPlaceholder source={source} sourceKind={sourceKind} />;
}

