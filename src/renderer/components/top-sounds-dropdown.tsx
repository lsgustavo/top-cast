import { useState, useEffect, useRef } from 'react';
import {
  AudioWaveform,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import {
  SOUNDBOARD_CLIPS,
  soundboardManager,
  getSoundboardVolume,
  saveSoundboardVolume,
  type SoundboardClip,
} from '../lib/soundboard';

export type TopSoundsPlacement =
  | 'top'
  | 'top-right'
  | 'top-left'
  | 'bottom'
  | 'bottom-right'
  | 'bottom-left';

interface TopSoundsDropdownProps {
  placement?: TopSoundsPlacement;
  className?: string;
  triggerClassName?: string;
  triggerSize?: 'default' | 'sm';
  showLabel?: boolean;
}

export function TopSoundsDropdown({
  placement = 'top-right',
  className,
  triggerClassName,
  triggerSize = 'sm',
  showLabel = false,
}: TopSoundsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeClipIds, setActiveClipIds] = useState<string[]>([]);
  const [volume, setVolume] = useState<number>(getSoundboardVolume);
  const [showVolumeControl, setShowVolumeControl] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = soundboardManager.subscribe((activeIds) => {
      setActiveClipIds(activeIds);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleVolumeChange = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        setVolume(customEvent.detail);
      }
    };
    window.addEventListener('topcast:soundboard-volume-changed', handleVolumeChange);
    return () => {
      window.removeEventListener('topcast:soundboard-volume-changed', handleVolumeChange);
    };
  }, []);

  // Fecha o dropdown apenas quando clica estritamente FORA do dropdown ou pressiona Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      // Se o clique foi no container do componente ou dentro do dropdown, permanece aberto!
      if (containerRef.current?.contains(target)) return;
      if ((target as Element).closest?.('[data-top-sounds-dropdown]')) return;

      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleTogglePlay = (clip: SoundboardClip, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeClipIds.includes(clip.id)) {
      soundboardManager.stop(clip.id);
    } else {
      soundboardManager.play(clip, volume);
    }
    // Permanece aberto ao clicar nos sons para permitir múltiplos disparos seguidos
  };

  const handleVolumeSliderChange = (vals: number[]) => {
    const newVol = (vals[0] ?? 80) / 100;
    setVolume(newVol);
    saveSoundboardVolume(newVol);
    soundboardManager.setVolume(newVol);
  };

  const anyPlaying = activeClipIds.length > 0;

  const getPlacementClasses = () => {
    switch (placement) {
      case 'top-left':
        return 'bottom-full mb-2 right-0 origin-bottom-right';
      case 'bottom-right':
      case 'bottom':
        return 'top-full mt-2 left-0 origin-top-left';
      case 'bottom-left':
        return 'top-full mt-2 right-0 origin-top-right';
      case 'top-right':
      case 'top':
      default:
        // Abre para CIMA e para a DIREITA
        return 'bottom-full mb-2 left-0 origin-bottom-left';
    }
  };

  return (
    <div
      ref={containerRef}
      data-top-sounds-dropdown
      className={cn('relative inline-block', className)}
    >
      {/* Botão Gatilho */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={showLabel ? 'sm' : 'icon'}
            aria-haspopup="true"
            aria-expanded={isOpen}
            aria-label="Top Sounds (Soundboard)"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className={cn(
              'relative rounded-xl border transition-all duration-150 focus-visible:ring-primary',
              triggerSize === 'sm' ? 'h-8 px-2' : 'h-9 px-2.5',
              !showLabel && (triggerSize === 'sm' ? 'w-8 p-0' : 'w-9 p-0'),
              isOpen || anyPlaying
                ? 'border-primary/50 bg-primary/20 text-primary hover:bg-primary/25'
                : 'border-border/40 bg-slate-900/60 text-slate-300 backdrop-blur-md hover:border-border/70 hover:bg-slate-800 hover:text-slate-100',
              triggerClassName,
            )}
          >
            <AudioWaveform className={cn('h-4 w-4', anyPlaying && 'animate-pulse text-primary')} />
            {showLabel && <span className="ml-1.5 text-xs font-medium">Top Sounds</span>}

            {anyPlaying && (
              <span
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-slate-950 animate-ping"
                aria-hidden="true"
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={placement.startsWith('top') ? 'top' : 'bottom'}>
          {anyPlaying ? `Top Sounds (${activeClipIds.length} tocando)` : 'Top Sounds'}
        </TooltipContent>
      </Tooltip>

      {/* Dropdown Menu Estilo Discord: para CIMA e para a DIREITA com z-[100] acima dos outros drops */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Top Sounds Soundboard"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute z-[100] w-72 sm:w-80 overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150 ease-out select-none',
            getPlacementClasses(),
          )}
        >
          {/* Header simples estilo Discord: Icon + Top Sounds */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/30">
            <div className="flex items-center gap-1.5 text-slate-200">
              <AudioWaveform className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold tracking-tight text-slate-100">Top Sounds</span>
            </div>

            <div className="flex items-center gap-1">

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVolumeControl((v) => !v);
                }}
                aria-label="Ajustar volume do soundboard"
                className={cn(
                  'h-6 w-6 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800',
                  showVolumeControl && 'bg-slate-800 text-slate-100',
                )}
              >
                {volume === 0 ? (
                  <VolumeX className="h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Controle de volume expansível */}
          {showVolumeControl && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mb-2.5 rounded-xl border border-border/30 bg-slate-950/50 p-2.5 animate-in fade-in-0 duration-150"
            >
              <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400">
                <span>Volume</span>
                <span className="font-mono font-medium tabular-nums">{Math.round(volume * 100)}%</span>
              </div>
              <Slider
                value={[Math.round(volume * 100)]}
                min={0}
                max={100}
                step={1}
                onValueChange={handleVolumeSliderChange}
                aria-label="Volume do Top Sounds"
                className="py-1"
              />
            </div>
          )}

          {/* Grid de sons (estilo botões do Discord) */}
          <div className="grid grid-cols-2 gap-2">
            {SOUNDBOARD_CLIPS.map((clip) => {
              const isPlaying = activeClipIds.includes(clip.id);

              return (
                <button
                  key={clip.id}
                  type="button"
                  onClick={(e) => handleTogglePlay(clip, e)}
                  aria-label={`Reproduzir ${clip.name}`}
                  className={cn(
                    'group relative flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isPlaying
                      ? 'border-primary/60 bg-primary/20 text-primary shadow-sm ring-1 ring-primary/40 active:scale-95'
                      : 'border-border/30 bg-slate-800/80 text-slate-200 hover:border-border/60 hover:bg-slate-700/80 hover:text-white active:scale-95 shadow-sm',
                  )}
                >
                  {/* Emoji do som */}
                  <span className="text-base shrink-0 transition-transform duration-150">
                    {clip.emoji}
                  </span>

                  {/* Nome do som */}
                  <span className="truncate text-xs font-medium tracking-tight">
                    {clip.name}
                  </span>

                  {/* Micro equalizador quando estiver tocando */}
                  {isPlaying && (
                    <span className="ml-auto flex items-end gap-0.5 h-3 shrink-0">
                      <span className="w-0.5 bg-primary rounded-full animate-bounce h-1.5" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.5 bg-primary rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.5 bg-primary rounded-full animate-bounce h-2" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Export compatível
export const SoundboardDropdown = TopSoundsDropdown;
