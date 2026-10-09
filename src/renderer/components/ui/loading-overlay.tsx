import * as React from 'react';
import { cn } from '../../lib/utils';

export interface LoadingOverlayProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingOverlay({
  title = 'Carregando…',
  description,
  className,
}: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md duration-200 animate-in fade-in-0',
        className,
      )}
    >
      <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/90 px-8 py-7 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="relative flex h-14 w-14 items-center justify-center">
          {/* Pulso de fundo */}
          <div className="absolute h-full w-full animate-ping rounded-full bg-blue-500/20" />
          
          {/* Anel giratório externo */}
          <div className="h-14 w-14 animate-spin rounded-full border-[2.5px] border-slate-800 border-t-blue-500 border-r-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
          
          {/* Ponto brilhante central */}
          <div className="absolute h-3 w-3 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold tracking-tight text-slate-100">{title}</p>
          {description && (
            <p className="mt-1 text-xs text-slate-400">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

