import type { TopCastApi } from '../shared/types/desktop-api';

declare global {
  interface Window {
    topCast?: TopCastApi;
  }
}

export {};
