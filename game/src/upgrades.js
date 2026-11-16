// upgrades.js — the reward for clearing a wave: three cards, pick one.
// Every upgrade bends a number the player can feel on the next wave, and
// most stack, so a long run grows into a build. game.js owns the state;
// this file owns the pool and how a pick is applied.

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Pollen',
    blurb: 'Fire seed-bolts 18% faster.',
    glyph: 'rapid',
    apply: (game) => { game.player.fireInterval *= 0.82; },
  },
  {
    id: 'heavy',
    name: 'Heavy Seeds',
    blurb: '+1 damage on every seed-bolt.',
    glyph: 'heavy',
    apply: (game) => { game.player.boltDamage += 1; },
  },
  {
    id: 'split',
    name: 'Split Stem',
    blurb: '+1 seed-bolt per shot, fanned out.',
    glyph: 'split',
    apply: (game) => { game.player.projectiles += 1; },
  },
  {
    id: 'pierce',
    name: 'Thorn Tips',
    blurb: 'Seed-bolts pierce +1 extra pest.',
    glyph: 'pierce',
    apply: (game) => { game.player.pierce += 1; },
  },
  {
    id: 'swift',
    name: 'Swift Boots',
    blurb: 'Move 12% faster around the garden.',
    glyph: 'swift',
    apply: (game) => { game.player.speed *= 1.12; },
  },
  {
    id: 'heart',
    name: 'Warden Heart',
    blurb: '+1 max health, and mend 2 now.',
    glyph: 'heart',
    apply: (game) => {
      game.playerMaxHp += 1;
      game.player.hp = Math.min(game.playerMaxHp, game.player.hp + 2);
    },
  },
  {
    id: 'mend',
    name: 'Bloom Mending',
    blurb: 'The Bloom heals 30 health at once.',
    glyph: 'mend',
    apply: (game) => {
      game.bloom.hp = Math.min(game.bloom.maxHp, game.bloom.hp + 30);
    },
  },
  {
    id: 'magnet',
    name: 'Pollen Charm',
    blurb: 'Pickups drift to you from 70% farther.',
    glyph: 'magnet',
    apply: (game) => { game.player.magnetRadius *= 1.7; },
  },
  {
    id: 'thorns',
    name: 'Bloom Thorns',
    blurb: 'Pests chewing the Bloom take 2 damage a bite.',
    glyph: 'thorns',
    apply: (game) => { game.bloom.thornDamage += 2; },
  },
];

// Draw three distinct cards. Mend and Heart are offered less often once the
// garden is nearly whole, so a healthy run keeps growing teeth instead.
export function drawChoices(game, rng) {
  const pool = UPGRADES.filter((u) => {
    if (u.id === 'mend' && game.bloom.hp > game.bloom.maxHp * 0.85) return false;
    if (u.id === 'heart' && game.player.hp >= game.playerMaxHp) return rng.chance(0.4);
    return true;
  });
  return rng.shuffle(pool).slice(0, 3);
}
