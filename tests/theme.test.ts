import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
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
      },
    } as unknown as Document;
  });

  it('provides well-formed theme options with distinct primary colors', () => {
    assert.ok(THEME_OPTIONS.length >= 6);
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
  });

  it('defaults to cyber-blue when no theme is persisted', () => {
    assert.equal(getSavedTheme(), DEFAULT_THEME);
    assert.equal(DEFAULT_THEME, 'cyber-blue');
  });

  it('persists and applies chosen theme to document.documentElement and localStorage', () => {
    const targetTheme: ThemeId = 'midnight-violet';
    applyTheme(targetTheme);

    assert.equal(document.documentElement.getAttribute('data-theme'), 'midnight-violet');
    assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'midnight-violet');
    assert.equal(getSavedTheme(), 'midnight-violet');
  });

  it('falls back to DEFAULT_THEME if stored theme id is invalid', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'invalid-nonexistent-theme');
    assert.equal(getSavedTheme(), DEFAULT_THEME);
  });
});

