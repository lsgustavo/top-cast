import { useEffect, useRef, useState } from 'react';
import { Dice5, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { VoxelAvatar } from './voxel-avatar';
import { generateRandomAvatarOptions } from '../lib/voxel-avatar';
import { cn } from '../lib/utils';

interface AvatarPickerDialogProps {
  displayName: string;
  avatarSeed: string;
  onSelectAvatar: (seed: string) => void;
  triggerClassName?: string;
  iconClassName?: string;
  tooltipText?: string;
  triggerLabel?: string;
  children?: React.ReactNode;
}

export function AvatarPickerDialog({
  displayName,
  avatarSeed,
  onSelectAvatar,
  triggerClassName,
  iconClassName = 'h-4 w-4',
  tooltipText = 'Editar foto de perfil',
  triggerLabel = 'Editar foto de perfil',
  children,
}: AvatarPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [selectedSeed, setSelectedSeed] = useState(avatarSeed);
  const [options, setOptions] = useState<string[]>(() =>
    generateRandomAvatarOptions(8, avatarSeed),
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setSelectedSeed(avatarSeed);
  }, [avatarSeed]);

  useEffect(() => {
    setTooltipOpen(false);
    if (open && !wasOpenRef.current) {
      setSelectedSeed(avatarSeed);
      setOptions((prev) => {
        if (prev.length === 8 && prev.includes(avatarSeed)) {
          return prev;
        }
        return generateRandomAvatarOptions(8, avatarSeed);
      });
    }
    wasOpenRef.current = open;
  }, [open, avatarSeed]);

  function handleRandomizeOptions() {
    setOptions(generateRandomAvatarOptions(8));
  }

  function handleChooseOption(seed: string) {
    setSelectedSeed(seed);
    onSelectAvatar(seed);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setTooltipOpen(false);
        setOpen(nextOpen);
      }}
    >
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : (
        <Tooltip open={!open && tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={triggerLabel}
                onFocus={(e) => {
                  if (!e.currentTarget.matches(':hover')) {
                    setTooltipOpen(false);
                  }
                }}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-slate-950/70 text-slate-400 shadow-sm transition-colors duration-150 hover:border-border/80 hover:bg-slate-800/70 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  triggerClassName,
                )}
              >
                <Pencil className={iconClassName} />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      )}

      <DialogContent
        onMouseEnter={(e) => e.stopPropagation()}
        onMouseLeave={(e) => e.stopPropagation()}
        className="max-w-md overflow-hidden rounded-2xl border border-border/40 bg-slate-900/95 p-0 text-slate-100 shadow-2xl backdrop-blur-xl"
      >
        <div className="border-b border-border/40 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <Pencil className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight text-slate-100">
                  Escolher Foto de Perfil
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-400">
                  Selecione uma opção abaixo ou gere novas opções.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Preview do avatar selecionado + botão gerar opções */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-slate-950/60 p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-slate-900 shadow-inner">
                <VoxelAvatar displayName={displayName || 'Você'} seed={selectedSeed} />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-xs font-semibold text-slate-100">
                  Avatar atual
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                  {displayName || 'Você'}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleRandomizeOptions}
              aria-label="Gerar novas opções de avatar"
              className="h-9 shrink-0 gap-2 rounded-xl border-border/40 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:border-primary/40 hover:bg-slate-800 hover:text-white"
            >
              <Dice5 className="h-4 w-4 text-primary" />
              <span>Gerar novas opções</span>
            </Button>
          </div>

          {/* Grade de opções de avatar */}
          <div>
            <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Opções de foto de perfil
            </span>
            <div
              role="radiogroup"
              aria-label="Opções de foto de perfil"
              className="grid grid-cols-4 gap-3"
            >
              {options.map((optionSeed, index) => {
                const isSelected = selectedSeed === optionSeed;
                return (
                  <button
                    key={`${optionSeed}-${index}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Opção de avatar ${index + 1}`}
                    onClick={() => handleChooseOption(optionSeed)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-2xl border p-1.5 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isSelected
                        ? 'border-primary bg-primary/15 shadow-sm'
                        : 'border-border/40 bg-slate-950/60 hover:border-border/80 hover:bg-slate-900/80',
                    )}
                  >
                    <div className="h-full w-full overflow-hidden rounded-xl bg-slate-900 shadow-inner">
                      <VoxelAvatar
                        displayName={displayName || 'Você'}
                        seed={optionSeed}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-border/40 bg-slate-950/40 px-6 py-4">
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Concluir
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

