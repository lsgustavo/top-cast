import { useState, useEffect } from 'react';
import {
  AudioWaveform,
  Play,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  Search,
  Music,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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

interface SoundboardDialogProps {
  children?: React.ReactNode;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SoundboardDialog({
  children,
  triggerClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SoundboardDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [volume, setVolume] = useState<number>(getSoundboardVolume);
  const [activeClipIds, setActiveClipIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    controlledOnOpenChange?.(newOpen);
  };

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

  const handleVolumeSliderChange = (vals: number[]) => {
    const newVol = (vals[0] ?? 80) / 100;
    setVolume(newVol);
    saveSoundboardVolume(newVol);
    soundboardManager.setVolume(newVol);
  };

  const handleTogglePlay = (clip: SoundboardClip) => {
    if (activeClipIds.includes(clip.id)) {
      soundboardManager.stop(clip.id);
    } else {
      soundboardManager.play(clip, volume);
    }
  };

  const handleStopAll = () => {
    soundboardManager.stopAll();
  };

  const filteredClips = SOUNDBOARD_CLIPS.filter((clip) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      clip.name.toLowerCase().includes(query) ||
      clip.description.toLowerCase().includes(query) ||
      clip.tags?.some((t) => t.toLowerCase().includes(query))
    );
  });

  const anyPlaying = activeClipIds.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Abrir Soundboard"
                className={cn(
                  'relative h-8 w-8 rounded-xl transition-all duration-150 focus-visible:ring-primary',
                  anyPlaying
                    ? 'bg-primary/20 text-primary shadow-sm hover:bg-primary/25 active:scale-95'
                    : 'bg-slate-900/60 text-slate-400 backdrop-blur-md hover:bg-slate-800 hover:text-slate-100 active:scale-95',
                  triggerClassName,
                )}
              >
                <AudioWaveform className={cn('h-4 w-4', anyPlaying && 'animate-pulse text-primary')} />
                {anyPlaying && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-slate-950 animate-ping"
                    aria-hidden="true"
                  />
                )}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {anyPlaying ? `Soundboard (${activeClipIds.length} tocando)` : 'Soundboard'}
          </TooltipContent>
        </Tooltip>
      )}

      <DialogContent className="max-w-md overflow-hidden rounded-2xl p-0 text-slate-100 glass-surface-elevated sm:max-w-md">

        {/* Header */}
        <div className="relative z-10 border-b border-border/30 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
                  <AudioWaveform className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
                      Soundboard
                    </DialogTitle>
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
                      {SOUNDBOARD_CLIPS.length} sons
                    </Badge>
                  </div>
                  <DialogDescription className="mt-0.5 text-xs text-slate-400">
                    Dispare efeitos sonoros instantâneos na sua transmissão
                  </DialogDescription>
                </div>
              </div>

              {anyPlaying && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleStopAll}
                  aria-label="Parar todos os sons"
                  className="h-8 gap-1 rounded-xl bg-destructive/15 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/25 active:scale-95"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Parar</span>
                </Button>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col gap-4 px-6 py-5">
          {/* Controle de Volume do Soundboard */}
          <div className="rounded-xl border border-border/25 bg-slate-900/40 p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-200">Volume dos Efeitos</span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <Slider
              value={[Math.round(volume * 100)]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleVolumeSliderChange}
              aria-label="Volume do Soundboard"
              className="py-1"
            />
          </div>

          {/* Campo de Busca Rápida (caso haja vários sons) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar efeito sonoro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8.5 rounded-xl border border-border/30 bg-slate-950/60 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 transition-all"
            />
          </div>

          {/* Grid de Sons */}
          <div className="flex flex-col gap-2.5 max-h-[260px] overflow-y-auto pr-0.5">
            {filteredClips.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Nenhum efeito sonoro encontrado para "{searchQuery}".
              </div>
            ) : (
              filteredClips.map((clip) => {
                const isPlaying = activeClipIds.includes(clip.id);

                return (
                  <div
                    key={clip.id}
                    onClick={() => handleTogglePlay(clip)}
                    className={cn(
                      'group relative flex cursor-pointer items-center justify-between gap-3.5 rounded-xl border p-3.5 transition-all select-none',
                      isPlaying
                        ? 'border-primary/50 bg-primary/15 shadow-sm ring-1 ring-primary/30'
                        : 'border-border/25 bg-slate-900/40 hover:bg-slate-900/70 hover:border-border/40',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors',
                          isPlaying
                            ? 'bg-primary/25 text-primary shadow-sm'
                            : 'bg-slate-900 text-slate-400 group-hover:text-slate-200',
                        )}
                      >
                        {isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3.5">
                            <span className="w-0.5 bg-primary rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                            <span className="w-0.5 bg-primary rounded-full animate-bounce h-3.5" style={{ animationDelay: '150ms' }} />
                            <span className="w-0.5 bg-primary rounded-full animate-bounce h-2.5" style={{ animationDelay: '300ms' }} />
                          </div>
                        ) : (
                          <Music className="h-4 w-4" />
                        )}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="block truncate text-xs font-semibold text-slate-100">
                            {clip.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 font-medium tracking-wide uppercase shrink-0 bg-slate-800/80 text-slate-400 border border-border/30"
                          >
                            {clip.category}
                          </Badge>
                        </div>
                        <span className="block truncate text-[11px] leading-4 text-slate-400 mt-0.5">
                          {clip.description}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant={isPlaying ? 'destructive' : 'ghost'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePlay(clip);
                        }}
                        aria-label={isPlaying ? `Parar som ${clip.name}` : `Tocar som ${clip.name}`}
                        className={cn(
                          'h-8 w-8 rounded-xl border transition-all backdrop-blur-md',
                          isPlaying
                            ? 'border-destructive/40 bg-destructive/20 text-destructive hover:bg-destructive/30'
                            : 'border-primary/20 bg-slate-900/70 text-slate-300 hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
                        )}
                      >
                        {isPlaying ? (
                          <Square className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-primary/15 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Sparkles className="h-3 w-3 text-primary/70 shrink-0" />
            <span>Sons executados localmente e no microfone/áudio.</span>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-8 gap-1.5 rounded-xl border border-primary/30 bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Concluído</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

