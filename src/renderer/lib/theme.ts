import { useEffect, useState } from 'react';

export type ThemeId = 'dark' | 'light';

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
    id: 'dark',
    name: 'Modo Escuro',
    description: 'Blurple vibrante sobre ardósia escura',
    primaryColor: '#5865F2',
    secondaryColor: '#2b2d31',
    bgColor: '#1e1f22',
    accentColor: '#7289da',
  },
  {
    id: 'light',
    name: 'Modo Claro',
    description: 'Interface límpida e confortável com acentos Blurple refinados',
    primaryColor: '#4752C4',
    secondaryColor: '#ffffff',
    bgColor: '#f2f3f5',
    accentColor: '#5865f2',
  },
] as const;

export const DEFAULT_THEME: ThemeId = 'dark';
export const THEME_STORAGE_KEY = 'topcast:theme';

export function getSavedTheme(): ThemeId {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'aurora-pearl') {
        return 'light';
      }
      if (saved === 'dark' || saved === 'graphite' || saved === 'cyber-blue') {
        return 'dark';
      }
      if (saved && THEME_OPTIONS.some((theme) => theme.id === saved)) {
        return saved as ThemeId;
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
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
