import { Style, Avatar } from '@dicebear/core';
import voxelArt from '@dicebear/styles/voxel-art.json';

const voxelArtStyle = new Style(voxelArt as any);

const svgCache = new Map<string, string>();
const dataUriCache = new Map<string, string>();

/**
 * Returns raw SVG markup string for a voxel art avatar using DiceBear JS library.
 */
export function getVoxelAvatarSvg(seed: string): string | null {
  try {
    const normalizedSeed = seed.trim();
    if (!normalizedSeed) return null;
    const cached = svgCache.get(normalizedSeed);
    if (cached) return cached;

    const avatar = new Avatar(voxelArtStyle, {
      seed: normalizedSeed,
    });
    const svg = avatar.toString();
    svgCache.set(normalizedSeed, svg);
    return svg;
  } catch (err) {
    console.error('Failed to generate DiceBear voxel SVG:', err);
    return null;
  }
}

/**
 * Returns a Data URI for a voxel art avatar using DiceBear JS library.
 * The output is deterministic based on the seed.
 */
export function getVoxelAvatarDataUri(seed: string): string | null {
  try {
    const normalizedSeed = seed.trim();
    if (!normalizedSeed) return null;
    const cached = dataUriCache.get(normalizedSeed);
    if (cached) return cached;

    const avatar = new Avatar(voxelArtStyle, {
      seed: normalizedSeed,
    });
    const uri = avatar.toDataUri();
    dataUriCache.set(normalizedSeed, uri);
    return uri;
  } catch (err) {
    console.error('Failed to generate DiceBear voxel Data URI:', err);
    return null;
  }
}

/**
 * Generates an unpredictable random seed for new avatars.
 */
export function generateRandomAvatarSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 12);
}

/**
 * Generates a list of distinct random avatar seeds for the avatar picker modal.
 * If `currentSeed` is provided, includes it as the first option.
 */
export function generateRandomAvatarOptions(count = 8, currentSeed?: string): string[] {
  const options: string[] = [];
  const trimmedCurrent = currentSeed?.trim();
  if (trimmedCurrent) {
    options.push(trimmedCurrent);
  }
  while (options.length < count) {
    const candidate = generateRandomAvatarSeed();
    if (!options.includes(candidate)) {
      options.push(candidate);
    }
  }
  return options;
}

export const AVATAR_STORAGE_KEY = 'topcast:avatar_seed';

/**
 * Retrieves the local user's avatar seed from localStorage or generates a new random one.
 */
export function getOrCreateLocalAvatarSeed(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(AVATAR_STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
      const newSeed = generateRandomAvatarSeed();
      window.localStorage.setItem(AVATAR_STORAGE_KEY, newSeed);
      return newSeed;
    }
  } catch {
    // fallback
  }
  return generateRandomAvatarSeed();
}

/**
 * Persists the chosen avatar seed in localStorage.
 */
export function saveLocalAvatarSeed(seed: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AVATAR_STORAGE_KEY, seed);
    }
  } catch {
    // fallback
  }
}
