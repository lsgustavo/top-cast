import { useState } from 'react';
import { Check, Palette, Settings } from 'lucide-react';
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
import { useTheme, type ThemeId } from '../lib/theme';
import { cn } from '../lib/utils';

interface SettingsDialogProps {
  children?: React.ReactNode;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({
  children,
  triggerClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { theme: currentTheme, setTheme, themes } = useTheme();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    controlledOnOpenChange?.(newOpen);
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    setTheme(themeId);
  };

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
                aria-label="Abrir configurações do aplicativo"
                className={cn(
                  'h-9 w-9 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 transition-all hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-blue-400',
                  triggerClassName,
                )}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Configurações</TooltipContent>
        </Tooltip>
      )}

      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 p-0 text-slate-100 sm:rounded-2xl">
        {/* Header */}
        <div className="border-b border-slate-800/80 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-400">
                <Settings className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-slate-100">
                  Configurações
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-400">
                  Personalize a aparência e preferências visuais do aplicativo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Conteúdo: Escopo Isolado para Troca de Tema */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          <section aria-labelledby="theme-section-title">
            <div className="flex items-center gap-2 pb-2">
              <Palette className="h-4 w-4 text-blue-400" />
              <h3 id="theme-section-title" className="text-sm font-semibold tracking-tight text-slate-200">
                Tema de Cores
              </h3>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              Escolha um tema que melhor se adapte ao seu estilo.
            </p>

            <div
              role="radiogroup"
              aria-labelledby="theme-section-title"
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
            >
              {themes.map((themeOption) => {
                const isSelected = currentTheme === themeOption.id;

                return (
                  <button
                    key={themeOption.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectTheme(themeOption.id)}
                    className={cn(
                      'group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-150',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      isSelected
                        ? 'border-blue-400/80 bg-blue-500/[0.08] shadow-md shadow-blue-500/10'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-950/80',
                    )}
                  >
                    {/* Badge de Selecionado */}
                    {isSelected && (
                      <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-blue-500 text-slate-950 shadow-sm">
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      </span>
                    )}

                    {/* Miniatura Swatch da Paleta */}
                    <div
                      className="mb-3 flex h-14 w-full items-center justify-between rounded-lg border p-2 shadow-inner"
                      style={{
                        backgroundColor: themeOption.bgColor,
                        borderColor: isSelected ? themeOption.primaryColor : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {/* Cartão de visualização interna */}
                      <div
                        className="flex h-full flex-1 items-center gap-2 rounded-md border px-2.5"
                        style={{
                          backgroundColor: themeOption.secondaryColor,
                          borderColor: 'rgba(255,255,255,0.06)',
                        }}
                      >
                        {/* Ponto de cor primária */}
                        <span
                          className="h-3.5 w-3.5 rounded-full shadow-sm"
                          style={{ backgroundColor: themeOption.primaryColor }}
                        />
                        {/* Ponto de cor de destaque */}
                        <span
                          className="h-2.5 w-2.5 rounded-full opacity-80"
                          style={{ backgroundColor: themeOption.accentColor }}
                        />
                        {/* Barra decorativa de terciária */}
                        <span
                          className="h-1.5 flex-1 rounded-full opacity-40"
                          style={{ backgroundColor: themeOption.primaryColor }}
                        />
                      </div>
                    </div>

                    {/* Informações do Tema */}
                    <span className="block text-sm font-semibold text-slate-100">
                      {themeOption.name}
                    </span>
                    <span className="mt-1 block text-xs leading-4 text-slate-400 line-clamp-2">
                      {themeOption.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-800/80 px-6 py-4">
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-slate-800 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

