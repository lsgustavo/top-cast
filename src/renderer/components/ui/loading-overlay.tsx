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
      <div className="relative flex min-w-56 flex-col items-center gap-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/95 px-7 py-6 shadow-2xl shadow-black/70 backdrop-blur-xl">
        {/* Spinner simples, discreto e profissional */}
        <div className="flex h-10 w-10 items-center justify-center text-primary">
          <svg
            className="h-8 w-8 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9.5"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              className="opacity-15"
            />
            <path
              d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium tracking-tight text-slate-100">{title}</p>
          {description && (
            <p className="mt-1 max-w-xs text-xs text-slate-400 leading-normal">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

