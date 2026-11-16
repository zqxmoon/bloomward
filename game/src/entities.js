// entities.js — plain-object factories for everything that moves in the
// garden: the Warden, the four pest kinds, seed-bolts, sap globs, pickups,
// particles and floating score text. Behaviour lives in game.js; this file
// only decides what a fresh thing looks like.

import { BLOOM, BOLT, PEST_KINDS, PLAYER, PICKUP } from './config.js';

export function makePlayer() {
  return {
    x: BLOOM.x,
    y: BLOOM.y + 120,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    aimAngle: -Math.PI / 2,
    fireTimer: 0,
    iframes: 0,
    walkPhase: 0,
    // Stats the upgrade cards bend; they start at the config baselines.
    speed: PLAYER.baseSpeed,
    fireInterval: BOLT.baseInterval,
    boltDamage: BOLT.baseDamage,
    projectiles: 1,
    pierce: 0,
    magnetRadius: PICKUP.baseMagnetRadius,
  };
}

export function makePest(kind, x, y, hpScale, rng) {
  const def = PEST_KINDS[kind];
  const hp = Math.max(1, Math.round(def.hp * hpScale));
  return {
    kind,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp,
    maxHp: hp,
    speed: def.speed * rng.range(0.88, 1.12),
    chewTimer: rng.range(0.2, def.chewSeconds),
    sapTimer: rng.range(1.1, def.sapSeconds || 2.4),
    flash: 0,
    knockX: 0,
    knockY: 0,
    wobble: rng.range(0, Math.PI * 2),
    contactTimer: 0,
  };
}

export function makeBolt(x, y, angle, damage, pierce) {
  return {
    x,
    y,
    vx: Math.cos(angle) * BOLT.speed,
    vy: Math.sin(angle) * BOLT.speed,
    radius: BOLT.radius,
    damage,
    pierce,
    life: BOLT.lifeSeconds,
    trail: [],
  };
}

export function makeSap(x, y, targetX, targetY, def) {
  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.hypot(dx, dy) || 1;
  return {
    x,
    y,
    vx: (dx / dist) * def.sapSpeed,
    vy: (dy / dist) * def.sapSpeed,
    radius: 6,
    damage: def.sapDamage,
    life: 3.2,
  };
}

export function makePickup(kind, x, y, rng) {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    age: 0,
    bobPhase: rng.range(0, Math.PI * 2),
  };
}

export function makeParticle(x, y, colour, rng, speed) {
  const pace = speed || 130;
  const angle = rng.range(0, Math.PI * 2);
  const mag = rng.range(pace * 0.25, pace);
  const life = rng.range(0.3, 0.7);
  return {
    x,
    y,
    vx: Math.cos(angle) * mag,
    vy: Math.sin(angle) * mag,
    life,
    maxLife: life,
    size: rng.range(2, 4.6),
    colour,
  };
}

export function makeFloater(x, y, text, colour) {
  return { x, y, text, colour, life: 0.95, maxLife: 0.95 };
}

// Spawn just outside a random edge of the garden, never in a corner pocket.
export function edgeSpawnPoint(rng, width, height) {
  const margin = 30;
  const side = rng.int(0, 3);
  if (side === 0) return { x: rng.range(margin, width - margin), y: -margin };
  if (side === 1) return { x: width + margin, y: rng.range(margin, height - margin) };
  if (side === 2) return { x: rng.range(margin, width - margin), y: height + margin };
  return { x: -margin, y: rng.range(margin, height - margin) };
}
