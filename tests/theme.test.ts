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

  it('provides well-formed theme options with distinct primary colors including graphite and aurora-pearl', () => {
    assert.ok(THEME_OPTIONS.length >= 8);
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

    assert.ok(ids.has('graphite'));
    assert.ok(ids.has('aurora-pearl'));
  });

  it('defaults to graphite when no theme is persisted', () => {
    assert.equal(getSavedTheme(), DEFAULT_THEME);
    assert.equal(DEFAULT_THEME, 'graphite');
  });

  it('persists and applies chosen theme to document.documentElement and localStorage', () => {
    const targetTheme: ThemeId = 'aurora-pearl';
    applyTheme(targetTheme);

    assert.equal(document.documentElement.getAttribute('data-theme'), 'aurora-pearl');
    assert.equal(window.localStorage.getItem(THEME_STORAGE_KEY), 'aurora-pearl');
    assert.equal(getSavedTheme(), 'aurora-pearl');
  });

  it('falls back to DEFAULT_THEME if stored theme id is invalid', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'invalid-nonexistent-theme');
    assert.equal(getSavedTheme(), DEFAULT_THEME);
  });
});
