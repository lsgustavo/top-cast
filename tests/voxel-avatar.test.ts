import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getVoxelAvatarDataUri,
  getVoxelAvatarSvg,
  generateRandomAvatarSeed,
  generateRandomAvatarOptions,
  getOrCreateLocalAvatarSeed,
  saveLocalAvatarSeed,
  AVATAR_STORAGE_KEY,
} from '../src/renderer/lib/voxel-avatar.js';

describe('Voxel Art DiceBear Avatars', () => {
  it('generates a valid SVG data URI deterministically for a given seed', () => {
    const seed = 'test-member-123';
    const uri1 = getVoxelAvatarDataUri(seed);
    const uri2 = getVoxelAvatarDataUri(seed);

    assert.ok(uri1 && uri1.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.equal(uri1, uri2, 'Same seed must generate identical avatar data URI');
  });

  it('generates raw SVG markup and returns null for empty seeds', () => {
    const svg = getVoxelAvatarSvg('test-seed-xyz');
    assert.ok(svg && svg.includes('<svg') && svg.includes('</svg>'));

    assert.equal(getVoxelAvatarSvg(''), null);
    assert.equal(getVoxelAvatarDataUri(''), null);
  });

  it('generates different avatars for different seeds', () => {
    const uriAlice = getVoxelAvatarDataUri('alice');
    const uriBob = getVoxelAvatarDataUri('bob');

    assert.notEqual(uriAlice, uriBob);
  });

  it('generates random unpredictable seeds', () => {
    const seedA = generateRandomAvatarSeed();
    const seedB = generateRandomAvatarSeed();

    assert.ok(seedA.length > 0);
    assert.ok(seedB.length > 0);
    assert.notEqual(seedA, seedB);
  });

  it('retrieves and saves local avatar seeds with storage mock', () => {
    const storage = new Map<string, string>();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    };

    const initial = getOrCreateLocalAvatarSeed();
    assert.ok(initial.length > 0);
    assert.equal(getOrCreateLocalAvatarSeed(), initial);

    saveLocalAvatarSeed('custom-seed-xyz');
    assert.equal(storage.get(AVATAR_STORAGE_KEY), 'custom-seed-xyz');
    assert.equal(getOrCreateLocalAvatarSeed(), 'custom-seed-xyz');
  });

  it('generates distinct random avatar option lists for the avatar picker modal', () => {
    const withCurrent = generateRandomAvatarOptions(8, 'my-current-seed');
    assert.equal(withCurrent.length, 8);
    assert.equal(withCurrent[0], 'my-current-seed');
    assert.equal(new Set(withCurrent).size, 8);

    const freshBatch = generateRandomAvatarOptions(8);
    assert.equal(freshBatch.length, 8);
    assert.equal(new Set(freshBatch).size, 8);
  });
});

