import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_THEME,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  applyTheme,
  getSavedTheme,
  type ThemeId,
} from '../src/renderer/lib/theme.js';

describe('Theme Switcher', () => {
  beforeEach(() => {
    // Mock global window and localStorage for node test environment
    const storage = new Map<string, string>();
    const docAttributes = new Map<string, string>();
    const docClasses = new Set<string>();

    globalThis.window = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => storage.clear(),
      },
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Window & typeof globalThis;

    globalThis.document = {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          docAttributes.set(name, value);
        },
        getAttribute: (name: string) => docAttributes.get(name) ?? null,
        classList: {
          add: (cls: string) => docClasses.add(cls),
          remove: (cls: string) => docClasses.delete(cls),
          contains: (cls: string) => docClasses.has(cls),
        },
      },
    } as unknown as Document;
  });

  it('provides well-formed theme options supporting strictly Light Mode and Dark Mode', () => {
    assert.equal(THEME_OPTIONS.length, 2);
    const ids = new Set<string>();
    const primaryColors = new Set<string>();

    for (const theme of THEME_OPTIONS) {
      assert.ok(theme.id);
      assert.ok(theme.name);
      assert.ok(theme.description);
      assert.match(theme.primaryColor, /^#[0-9a-fA-F]{6}$/);
      assert.match(theme.bgColor, /^#[0-9a-fA-F]{6}$/);

      assert.ok(!ids.has(theme.id), `Duplicate theme id ${theme.id}`);
      assert.ok(!primaryColors.has(theme.primaryColor), `Duplicate primary color ${theme.primaryColor}`);

      ids.add(theme.id);
      primaryColors.add(theme.primaryColor);
    }

    assert.ok(ids.has('dark'));
    assert.ok(ids.has('light'));
  });

  it('defaults to dark when no theme is persisted', () => {
    assert.equal(getSavedTheme(), DEFAULT_THEME);
    assert.equal(DEFAULT_THEME, 'dark');
  });

  it('persists and applies chosen theme to document.documentElement and localStorage', () => {
    const targetTheme: ThemeId = 'light';
    applyTheme(targetTheme);

    assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
    assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'light');
    assert.equal(getSavedTheme(), 'light');
  });

  it('migrates legacy themes (graphite, cyber-blue, aurora-pearl) cleanly to dark or light', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'graphite');
    assert.equal(getSavedTheme(), 'dark');

    window.localStorage.setItem(THEME_STORAGE_KEY, 'aurora-pearl');
    assert.equal(getSavedTheme(), 'light');

    window.localStorage.setItem(THEME_STORAGE_KEY, 'cyber-blue');
    assert.equal(getSavedTheme(), 'dark');
  });

  it('falls back to DEFAULT_THEME if stored theme id is invalid', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'invalid-nonexistent-theme');
    assert.equal(getSavedTheme(), DEFAULT_THEME);
  });
});

describe('Adaptive Glassmorphism Surface System (4 Levels)', () => {
  const cssPath = path.resolve('src/renderer/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('defines utility classes for all 4 surface levels with backdrop-filter blur and shadows', () => {
    assert.ok(cssContent.includes('.glass-surface-base'));
    assert.ok(cssContent.includes('.glass-surface-secondary'));
    assert.ok(cssContent.includes('.glass-surface-primary'));
    assert.ok(cssContent.includes('.glass-surface-elevated'));

    assert.ok(cssContent.includes('var(--glass-secondary-blur'));
    assert.ok(cssContent.includes('var(--glass-primary-blur'));
    assert.ok(cssContent.includes('var(--glass-elevated-blur'));

    assert.ok(cssContent.includes('var(--glass-secondary-shadow)'));
    assert.ok(cssContent.includes('var(--glass-primary-shadow)'));
    assert.ok(cssContent.includes('var(--glass-elevated-shadow)'));
  });

  it('declares semantic surface tokens across Dark and Light modes', () => {
    const requiredThemes: readonly ThemeId[] = ['dark', 'light'];

    for (const themeId of requiredThemes) {
      assert.ok(cssContent.includes(themeId), `Theme ${themeId} must be declared in CSS`);
    }

    assert.ok(cssContent.includes('--glass-base-bg'));
    assert.ok(cssContent.includes('--glass-secondary-bg'));
    assert.ok(cssContent.includes('--glass-primary-bg'));
    assert.ok(cssContent.includes('--glass-elevated-bg'));
    assert.ok(cssContent.includes('--glass-secondary-border'));
    assert.ok(cssContent.includes('--glass-primary-border'));
    assert.ok(cssContent.includes('--glass-elevated-border'));
  });

  it('adapts Light Mode with luminous clean surface rather than dark tints', () => {
    assert.ok(cssContent.includes('/* Superfícies Flat / Material Moderno - Light Mode */'));
    assert.ok(cssContent.includes('--glass-secondary-bg: rgba(255, 255, 255, 0.72)'));
    assert.ok(cssContent.includes('--glass-primary-bg: rgba(255, 255, 255, 0.82)'));
    assert.ok(cssContent.includes('--glass-elevated-bg: rgba(255, 255, 255, 0.96)'));
  });

  it('provides dark glassmorphic surfaces for video overlays across all themes', () => {
    assert.ok(cssContent.includes('/* Dark Glassmorphism para sobreposições de vídeo */'));
    assert.ok(cssContent.includes('--glass-secondary-bg: rgba(15, 23, 42, 0.70)'));
    assert.ok(cssContent.includes('--glass-primary-bg: rgba(10, 15, 30, 0.78)'));
    assert.ok(cssContent.includes('--glass-elevated-bg: rgba(15, 23, 42, 0.94)'));
  });

  it('includes fallback styling when backdrop-filter is unsupported', () => {
    assert.ok(cssContent.includes('@supports not (backdrop-filter: blur(10px))'));
  });

  it('binds glass surface classes to core UI primitives and pages', () => {
    const dialogPath = path.resolve('src/renderer/components/ui/dialog.tsx');
    assert.ok(fs.readFileSync(dialogPath, 'utf8').includes('glass-surface-elevated'));

    const alertDialogPath = path.resolve('src/renderer/components/ui/alert-dialog.tsx');
    assert.ok(fs.readFileSync(alertDialogPath, 'utf8').includes('glass-surface-elevated'));

    const selectPath = path.resolve('src/renderer/components/ui/select.tsx');
    assert.ok(fs.readFileSync(selectPath, 'utf8').includes('glass-surface-elevated'));

    const roomPagePath = path.resolve('src/renderer/pages/RoomPage.tsx');
    const roomPageContent = fs.readFileSync(roomPagePath, 'utf8');
    assert.ok(roomPageContent.includes('glass-surface-primary'));
    assert.ok(roomPageContent.includes('glass-surface-secondary'));
    assert.ok(roomPageContent.includes('glass-surface-elevated'));

    const homePagePath = path.resolve('src/renderer/pages/HomePage.tsx');
    assert.ok(fs.readFileSync(homePagePath, 'utf8').includes('glass-surface-secondary'));
  });
});
