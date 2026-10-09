import { useEffect, useState } from 'react';

export type ThemeId =
  | 'cyber-blue'
  | 'midnight-violet'
  | 'emerald-matrix'
  | 'sunset-amber'
  | 'nordic-cyan'
  | 'crimson-rose';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  accentColor: string;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: 'cyber-blue',
    name: 'Cyber Blue',
    description: 'Azul cobalto clássico com fundo grafite escuro',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e293b',
    bgColor: '#0b1020',
    accentColor: '#60a5fa',
  },
  {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    description: 'Violeta elétrico com fundo obsidiana profundo',
    primaryColor: '#a855f7',
    secondaryColor: '#241437',
    bgColor: '#0d0814',
    accentColor: '#c084fc',
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    description: 'Verde esmeralda vibrante com fundo floresta negra',
    primaryColor: '#10b981',
    secondaryColor: '#142a20',
    bgColor: '#06120d',
    accentColor: '#34d399',
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Amber',
    description: 'Âmbar solar aconchegante com fundo carbono quente',
    primaryColor: '#f59e0b',
    secondaryColor: '#2b1b11',
    bgColor: '#140c08',
    accentColor: '#fbbf24',
  },
  {
    id: 'nordic-cyan',
    name: 'Nordic Cyan',
    description: 'Ciano glacial luminoso com fundo ardósia polar',
    primaryColor: '#06b6d4',
    secondaryColor: '#132834',
    bgColor: '#071116',
    accentColor: '#22d3ee',
  },
  {
    id: 'crimson-rose',
    name: 'Crimson Rose',
    description: 'Vermelho carmim marcante com fundo rubi escuro',
    primaryColor: '#f43f5e',
    secondaryColor: '#2e111a',
    bgColor: '#14070a',
    accentColor: '#fb7185',
  },
] as const;

export const DEFAULT_THEME: ThemeId = 'cyber-blue';
export const THEME_STORAGE_KEY = 'topcast:theme';

export function getSavedTheme(): ThemeId {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (saved && THEME_OPTIONS.some((theme) => theme.id === saved)) {
        return saved;
      }
    }
  } catch {
    // Falhas de acesso ao localStorage não devem quebrar o carregamento
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.dispatchEvent(new CustomEvent('topcast:theme-change', { detail: { theme } }));
    }
  } catch {
    // Ignora restrições de localStorage
  }
}

export function initTheme(): ThemeId {
  const current = getSavedTheme();
  applyTheme(current);
  return current;
}

export function useTheme(): {
  theme: ThemeId;
  setTheme: (newTheme: ThemeId) => void;
  themes: readonly ThemeOption[];
} {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getSavedTheme);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme: ThemeId }>;
      if (customEvent.detail?.theme) {
        setCurrentTheme(customEvent.detail.theme);
      }
    };

    window.addEventListener('topcast:theme-change', handleThemeChange);
    return () => {
      window.removeEventListener('topcast:theme-change', handleThemeChange);
    };
  }, []);

  const handleSetTheme = (newTheme: ThemeId) => {
    setCurrentTheme(newTheme);
    applyTheme(newTheme);
  };

  return {
    theme: currentTheme,
    setTheme: handleSetTheme,
    themes: THEME_OPTIONS,
  };
}

