import { integer, identifier } from '../contracts/validation.js';

/**
 * Version 1: Mulberry32, uint32 seed and [0,1) outputs.
 * Fork labels derive from the immutable seed, never the number of prior draws.
 * Own separate `physics` / `visual` forks; this is not a cryptographic generator.
 */
export function createRandom(seed) {
  integer(seed, 'seed', 0, 0xffffffff);
  let initialSeed = seed; let state = seed; let draws = 0;
  return Object.freeze({
    next() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      draws++;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    fork(label) {
      identifier(label, 'stream label');
      let hash = (2166136261 ^ initialSeed) >>> 0;
      for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619) >>> 0;
      return createRandom(hash);
    },
    reset(value = initialSeed) {
      integer(value, 'seed', 0, 0xffffffff);
      initialSeed = value; state = value; draws = 0;
    },
    snapshot() { return Object.freeze({ version: 1, seed: initialSeed, state, draws }); }
  });
}
