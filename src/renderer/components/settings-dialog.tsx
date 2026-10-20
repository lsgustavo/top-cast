import { useEffect, useRef, useState } from 'react';
import { Check, Palette, Settings, User } from 'lucide-react';
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
import { AvatarPickerDialog } from './avatar-picker-dialog';
import { VoxelAvatar } from './voxel-avatar';
import {
  getOrCreateLocalAvatarSeed,
  saveLocalAvatarSeed,
} from '../lib/voxel-avatar';
import { cn } from '../lib/utils';
import type { RoomParticipant } from '../../shared/types/signaling';

export type SettingsTab = 'themes' | 'user';

const DISPLAY_NAME_STORAGE_KEY = 'topcast:display-name';
const PRESENCE_STORAGE_KEY = 'topcast:presence';

function getStoredDisplayName(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? '';
}

function getStoredPresence(): RoomParticipant['presence'] {
  if (typeof window === 'undefined') return 'available';
  const saved = window.localStorage.getItem(PRESENCE_STORAGE_KEY);
  if (saved === 'available' || saved === 'away' || saved === 'busy') {
    return saved;
  }
  return 'available';
}

interface SettingsDialogProps {
  children?: React.ReactNode;
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTab?: SettingsTab;
  showProfileTab?: boolean;
  triggerLabel?: string;
  tooltipText?: string;
  displayName?: string;
  onDisplayNameChange?: (name: string) => void;
  avatarSeed?: string;
  onAvatarSeedChange?: (seed: string) => void;
  presence?: RoomParticipant['presence'];
  onPresenceChange?: (presence: RoomParticipant['presence']) => void;
}

const PRESENCE_OPTIONS: Array<{
  value: RoomParticipant['presence'];
  label: string;
  description: string;
  dotColor: string;
}> = [
  {
    value: 'available',
    label: 'Disponível',
    description: 'Online e pronto para participar',
    dotColor: 'bg-emerald-400',
  },
  {
    value: 'away',
    label: 'Ausente',
    description: 'Temporariamente longe do computador',
    dotColor: 'bg-amber-400',
  },
  {
    value: 'busy',
    label: 'Ocupado',
    description: 'Não perturbe durante a transmissão',
    dotColor: 'bg-red-400',
  },
];

export function SettingsDialog({
  children,
  triggerClassName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultTab = 'themes',
  showProfileTab = false,
  triggerLabel = 'Abrir configurações do aplicativo',
  tooltipText = 'Configurações',
  displayName: externalDisplayName,
  onDisplayNameChange,
  avatarSeed: externalAvatarSeed,
  onAvatarSeedChange,
  presence: externalPresence,
  onPresenceChange,
}: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    showProfileTab ? defaultTab : 'themes',
  );
  const { theme: currentTheme, setTheme, themes } = useTheme();

  const [localName, setLocalName] = useState<string>(() =>
    externalDisplayName !== undefined ? externalDisplayName : getStoredDisplayName(),
  );
  const [localAvatarSeed, setLocalAvatarSeed] = useState<string>(() =>
    externalAvatarSeed || getOrCreateLocalAvatarSeed(),
  );
  const [localPresence, setLocalPresence] = useState<RoomParticipant['presence']>(() =>
    externalPresence ?? getStoredPresence(),
  );
  const [nameSavedFeedback, setNameSavedFeedback] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setTooltipOpen(false);
    if (isOpen && !wasOpenRef.current) {
      setActiveTab(showProfileTab ? defaultTab : 'themes');
      setLocalName(
        externalDisplayName !== undefined ? externalDisplayName : getStoredDisplayName(),
      );
      setLocalAvatarSeed(externalAvatarSeed || getOrCreateLocalAvatarSeed());
      setLocalPresence(externalPresence ?? getStoredPresence());
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, defaultTab, showProfileTab, externalDisplayName, externalAvatarSeed, externalPresence]);

  const setOpen = (newOpen: boolean) => {
    setTooltipOpen(false);
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    controlledOnOpenChange?.(newOpen);
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    setTheme(themeId);
  };

  const handleSelectAvatar = (newSeed: string) => {
    saveLocalAvatarSeed(newSeed);
    setLocalAvatarSeed(newSeed);
    onAvatarSeedChange?.(newSeed);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('topcast:user-settings-updated', {
          detail: { avatarSeed: newSeed },
        }),
      );
    }
  };

  const handleNameChange = (value: string) => {
    const sliced = value.slice(0, 32);
    setLocalName(sliced);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, sliced);
      } catch {
        // ignore
      }
    }
  };

  const handleSaveName = () => {
    const trimmed = localName.trim().slice(0, 32);
    if (!trimmed) return;
    setLocalName(trimmed);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmed);
      } catch {
        // ignore
      }
      window.dispatchEvent(
        new CustomEvent('topcast:user-settings-updated', {
          detail: { displayName: trimmed },
        }),
      );
    }
    onDisplayNameChange?.(trimmed);
    setNameSavedFeedback(true);
    window.setTimeout(() => setNameSavedFeedback(false), 1800);
  };

  const handleSelectPresence = (nextPresence: RoomParticipant['presence']) => {
    setLocalPresence(nextPresence);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(PRESENCE_STORAGE_KEY, nextPresence);
      } catch {
        // ignore
      }
      window.dispatchEvent(
        new CustomEvent('topcast:user-settings-updated', {
          detail: { presence: nextPresence },
        }),
      );
    }
    onPresenceChange?.(nextPresence);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {children ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : (
        <Tooltip open={!isOpen && tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={triggerLabel}
                onFocus={(e) => {
                  if (!e.currentTarget.matches(':hover')) {
                    setTooltipOpen(false);
                  }
                }}
                className={cn(
                  'h-9 w-9 rounded-xl bg-slate-900/60 text-slate-400 backdrop-blur-md transition-all hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-primary',
                  triggerClassName,
                )}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      )}

      <DialogContent
        onMouseEnter={(e) => e.stopPropagation()}
        onMouseLeave={(e) => e.stopPropagation()}
        className="max-w-2xl overflow-hidden rounded-2xl p-0 text-slate-100 glass-surface-elevated"
      >
        {/* Header com navegação por abas */}
        <div className="border-b border-border/30 px-6 pt-5 pb-4">
          <DialogHeader className="text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
                  <Settings className="h-5 w-5" />
                </span>
                <div>
                  <DialogTitle className="text-lg font-semibold tracking-tight text-slate-100">
                    Configurações
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-slate-400">
                    {showProfileTab
                      ? 'Personalize seu perfil de usuário, status na sala e aparência do aplicativo.'
                      : 'Personalize a aparência e o tema de cores do aplicativo.'}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Abas: Temas | Perfil (exibidas apenas dentro de uma sala ativa) */}
          {showProfileTab && (
            <div
              role="tablist"
              aria-label="Abas de configurações"
              className="mt-4 flex items-center gap-2 rounded-xl border border-border/25 bg-slate-900/40 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'themes'}
                onClick={() => setActiveTab('themes')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all',
                  activeTab === 'themes'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200',
                )}
              >
                <Palette className="h-3.5 w-3.5" />
                <span>Temas</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'user'}
                onClick={() => setActiveTab('user')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all',
                  activeTab === 'user'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200',
                )}
              >
                <User className="h-3.5 w-3.5" />
                <span>Perfil</span>
              </button>
            </div>
          )}
        </div>

        {/* Conteúdo das Abas */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          {!showProfileTab || activeTab === 'themes' ? (
            <section aria-labelledby="theme-section-title">
              <div className="flex items-center gap-2 pb-2">
                <Palette className="h-4 w-4 text-primary" />
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
                        'group relative flex flex-col items-start rounded-xl p-3.5 text-left border transition-all duration-150',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isSelected
                          ? 'border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/30'
                          : 'border-border/25 bg-slate-900/40 hover:bg-slate-900/70 hover:border-border/40',
                      )}
                    >
                      {isSelected && (
                        <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-slate-950">
                          <Check className="h-3 w-3" />
                        </span>
                      )}

                      <div
                        className="mb-3 flex h-14 w-full items-center justify-between rounded-lg p-2 shadow-inner"
                        style={{
                          backgroundColor: themeOption.bgColor,
                        }}
                      >
                        <div
                          className="flex h-full flex-1 items-center gap-2.5 rounded-md px-3"
                          style={{
                            backgroundColor: themeOption.secondaryColor,
                          }}
                        >
                          <span
                            className="h-3.5 w-3.5 rounded-full shadow-sm ring-1 ring-white/10"
                            style={{ backgroundColor: themeOption.primaryColor }}
                          />
                          <span
                            className="h-2.5 w-2.5 rounded-full opacity-90 ring-1 ring-white/10"
                            style={{ backgroundColor: themeOption.accentColor }}
                          />
                          <div className="flex-1 flex flex-col gap-1">
                            <span
                              className="h-1.5 w-full rounded-full opacity-60"
                              style={{ backgroundColor: themeOption.primaryColor }}
                            />
                            <span
                              className="h-1 w-2/3 rounded-full opacity-30"
                              style={{ backgroundColor: themeOption.accentColor }}
                            />
                          </div>
                        </div>
                      </div>

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
          ) : (
            <section aria-labelledby="user-settings-section-title" className="space-y-5">
              <div>
                <div className="flex items-center gap-2 pb-1">
                  <User className="h-4 w-4 text-primary" />
                  <h3 id="user-settings-section-title" className="text-sm font-semibold tracking-tight text-slate-200">
                    Configurações de Perfil
                  </h3>
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  Personalize sua foto de perfil, seu nome na sala e seu status de presença.
                </p>
              </div>

              {/* 1. Foto de Perfil (Avatar Voxel Art com modal de opções) */}
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/25 bg-slate-900/40 p-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="relative shrink-0">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-950/60 ring-1 ring-border/40">
                      <VoxelAvatar displayName={localName || 'Você'} seed={localAvatarSeed} />
                    </div>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 shadow-sm',
                        PRESENCE_OPTIONS.find((o) => o.value === localPresence)?.dotColor ?? 'bg-emerald-400',
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-100">
                      Foto de Perfil
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Clique no botão de editar para escolher ou sortear novas opções
                    </span>
                  </div>
                </div>

                <AvatarPickerDialog
                  displayName={localName || 'Você'}
                  avatarSeed={localAvatarSeed}
                  onSelectAvatar={handleSelectAvatar}
                />
              </div>

              {/* 2. Nome na Sala */}
              <div className="rounded-2xl border border-border/25 bg-slate-900/40 p-4">
                <label
                  htmlFor="user-settings-display-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Nome na Sala
                </label>
                <p className="mt-0.5 text-xs text-slate-400">
                  Como os outros participantes verão você na sala.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="user-settings-display-name"
                    type="text"
                    maxLength={32}
                    value={localName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveName();
                      }
                    }}
                    placeholder="Seu nome de exibição"
                    className="h-10 flex-1 rounded-xl border border-border/25 bg-slate-950/60 px-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                  />
                  <Button
                    type="button"
                    disabled={localName.trim().length === 0}
                    onClick={handleSaveName}
                    className="h-10 shrink-0 gap-1.5 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {nameSavedFeedback ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Salvo!</span>
                      </>
                    ) : (
                      <span>Salvar nome</span>
                    )}
                  </Button>
                </div>
              </div>

              {/* 3. Status de Presença */}
              <div className="rounded-2xl border border-border/25 bg-slate-900/40 p-4">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Seu Status
                </span>
                <p className="mt-0.5 text-xs text-slate-400">
                  Defina sua disponibilidade visível para a sala.
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Status de presença">
                  {PRESENCE_OPTIONS.map((option) => {
                    const isSelected = localPresence === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleSelectPresence(option.value)}
                        className={cn(
                          'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                          isSelected
                            ? 'border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/30'
                            : 'border-border/25 bg-slate-900/30 hover:bg-slate-900/60 hover:border-border/40',
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                            <span className={cn('h-2.5 w-2.5 rounded-full', option.dotColor)} />
                            <span>{option.label}</span>
                          </span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <span className="mt-1 text-[11px] leading-4 text-slate-400">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border/30 px-6 py-4 bg-slate-950/40">
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border/40 bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
