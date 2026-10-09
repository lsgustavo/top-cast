import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  WELCOME_DISMISSED_STORAGE_KEY,
  isWelcomeDismissed,
  setWelcomeDismissed,
} from '../src/renderer/components/welcome-dialog.js';

describe('Welcome Dialog storage & state', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
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
    } as unknown as Window & typeof globalThis;
  });

  it('reports not dismissed initially by default', () => {
    assert.equal(isWelcomeDismissed(), false);
  });

  it('correctly sets and retrieves dismissed state in localStorage', () => {
    setWelcomeDismissed(true);
    assert.equal(window.localStorage.getItem(WELCOME_DISMISSED_STORAGE_KEY), 'true');
    assert.equal(isWelcomeDismissed(), true);

    setWelcomeDismissed(false);
    assert.equal(window.localStorage.getItem(WELCOME_DISMISSED_STORAGE_KEY), null);
    assert.equal(isWelcomeDismissed(), false);
  });
});

