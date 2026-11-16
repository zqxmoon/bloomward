// waves.js — the wave director. Each wave is a shuffled queue of pest kinds
// plus a spawn interval; later waves unlock new kinds, swell in number and
// harden. Kept separate from game.js so the difficulty curve reads as data.

const UNLOCK_WAVE = {
  crawler: 1,
  dart: 2,
  spitter: 3,
  brute: 4,
};

// Pest counts by kind for a wave. The mix shifts as the garden is overrun:
// darts and spitters take a growing share, brutes stay rare and heavy.
export function waveComposition(wave) {
  const crawlers = 5 + wave * 2;
  const darts = wave >= UNLOCK_WAVE.dart ? 2 + Math.floor(wave * 1.1) : 0;
  const spitters = wave >= UNLOCK_WAVE.spitter ? 1 + Math.floor((wave - 2) * 0.8) : 0;
  const brutes = wave >= UNLOCK_WAVE.brute ? Math.floor((wave - 2) / 2) : 0;
  return { crawler: crawlers, dart: darts, spitter: spitters, brute: brutes };
}

export function wavePlan(wave, rng) {
  const comp = waveComposition(wave);
  const queue = [];
  for (const [kind, count] of Object.entries(comp)) {
    for (let i = 0; i < count; i++) queue.push(kind);
  }
  return {
    queue: rng.shuffle(queue),
    total: queue.length,
    // Seconds between spawns: brisk early, a press later, never a flood.
    interval: Math.max(0.42, 1.15 - wave * 0.07),
    hpScale: 1 + (wave - 1) * 0.16,
    speedScale: 1 + Math.min(0.35, (wave - 1) * 0.03),
  };
}

// A short line shown on the wave banner so new arrivals are announced.
export function waveAnnouncement(wave) {
  if (wave === UNLOCK_WAVE.dart) return 'Dart Moths ride the wind!';
  if (wave === UNLOCK_WAVE.spitter) return 'Sap Spitters keep their distance!';
  if (wave === UNLOCK_WAVE.brute) return 'A Brute Beetle lumbers in!';
  if (wave === 7) return 'The garden is overrun — hold on!';
  if (wave === 10) return 'Wave ten. The Bloom believes in you.';
  return '';
}
