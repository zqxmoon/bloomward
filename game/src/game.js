// game.js — Bloomward's state machine and simulation. Owns the Warden, the
// Bloom, every pest, bolt, sap glob, pickup, particle and floater; steps
// them each frame; and moves between title, playing, upgrade, paused and
// game-over. Drawing is render.js's job; this file never touches a canvas.

import { BLOOM, BOLT, COMBO, PEST_KINDS, PICKUP, PLAYER, VIEW } from './config.js';
import {
  edgeSpawnPoint, makeBolt, makeFloater, makeParticle, makePest, makePickup, makePlayer, makeSap,
} from './entities.js';
import { drawChoices } from './upgrades.js';
import { waveAnnouncement, wavePlan } from './waves.js';

const BEST_KEY = 'bloomward_best';

export class Game {
  constructor(rng, sound) {
    this.rng = rng;
    this.sound = sound;
    this.state = 'title';
    this.time = 0;
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.best = 0;
    }
    this.ui = { buttons: {}, cards: [] };
    this.resetField();
  }

  resetField() {
    this.player = makePlayer();
    this.playerMaxHp = PLAYER.maxHp;
    this.bloom = { hp: BLOOM.maxHp, maxHp: BLOOM.maxHp, thornDamage: 0, pulse: 0 };
    this.pests = [];
    this.bolts = [];
    this.saps = [];
    this.pickups = [];
    this.particles = [];
    this.floaters = [];
    this.wave = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.kills = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.plan = null;
    this.choices = [];
    this.banner = { text: '', sub: '', timer: 0 };
    this.shake = 0;
    this.hurtFlash = 0;
    this.overReason = '';
    this.waveClearTimer = 0;
  }

  comboMult() {
    return 1 + Math.min(this.combo, COMBO.maxCounted) * COMBO.perStep;
  }

  startRun() {
    this.resetField();
    this.sound.startPad();
    this.nextWave();
  }

  nextWave() {
    this.wave += 1;
    this.plan = wavePlan(this.wave, this.rng);
    this.spawnQueue = this.plan.queue.slice();
    this.spawnTimer = 0.9;
    this.banner = {
      text: `Wave ${this.wave}`,
      sub: waveAnnouncement(this.wave),
      timer: 2.2,
    };
    this.state = 'playing';
    this.sound.waveStart();
  }

  gameOver(reason) {
    this.state = 'over';
    this.overReason = reason;
    this.best = Math.max(this.best, this.score);
    try {
      localStorage.setItem(BEST_KEY, String(this.best));
    } catch {
      // best score is a nicety
    }
    this.sound.stopPad();
    this.sound.gameOver();
  }

  // -- frame ---------------------------------------------------------------

  update(dt, input) {
    this.time += dt;
    if (input.tapped('m')) this.sound.toggleMute();
    if (this.banner.timer > 0) this.banner.timer -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    this.updateParticles(dt);
    this.updateFloaters(dt);

    if (this.state === 'title') {
      if (input.tapped('enter') || this.clickedButton('start', input)) this.startRun();
      return;
    }
    if (this.state === 'over') {
      if (input.tapped('enter') || this.clickedButton('restart', input)) this.startRun();
      if (this.clickedButton('title', input)) this.state = 'title';
      return;
    }
    if (this.state === 'upgrade') {
      this.updateUpgradeChoice(input);
      return;
    }
    if (input.tapped('p') || input.tapped('escape')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      this.sound.click();
      if (this.state === 'paused') return;
    }
    if (this.state === 'paused') {
      if (this.clickedButton('resume', input)) this.state = 'playing';
      return;
    }
    if (this.state !== 'playing') return;

    this.updateSpawning(dt);
    this.updatePlayer(dt, input);
    this.updatePests(dt);
    this.updateBolts(dt);
    this.updateSaps(dt);
    this.updatePickups(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.spawnQueue.length === 0 && this.pests.length === 0 && this.state === 'playing') {
      this.onWaveCleared();
    }
  }

  clickedButton(name, input) {
    if (!input.mouse.clicked) return false;
    const rect = this.ui.buttons[name];
    if (!rect) return false;
    const { x, y } = input.mouse;
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  updateUpgradeChoice(input) {
    for (let i = 0; i < this.choices.length; i++) {
      const key = String(i + 1);
      const rect = this.ui.cards[i];
      const byKey = input.tapped(key);
      const byClick = input.mouse.clicked && rect
        && input.mouse.x >= rect.x && input.mouse.x <= rect.x + rect.w
        && input.mouse.y >= rect.y && input.mouse.y <= rect.y + rect.h;
      if (byKey || byClick) {
        this.choices[i].apply(this);
        this.choices = [];
        this.sound.upgrade();
        this.burst(this.player.x, this.player.y, '#ffd166', 16);
        this.nextWave();
        return;
      }
    }
  }

  onWaveCleared() {
    const bonus = 50 + this.wave * 10;
    this.score += bonus;
    this.floaters.push(makeFloater(BLOOM.x, BLOOM.y - 90, `Wave clear  +${bonus}`, '#ffd166'));
    this.choices = drawChoices(this, this.rng);
    this.state = 'upgrade';
  }

  // -- spawning --------------------------------------------------------------

  updateSpawning(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const kind = this.spawnQueue.shift();
    const point = edgeSpawnPoint(this.rng, VIEW.width, VIEW.height);
    const pest = makePest(kind, point.x, point.y, this.plan.hpScale, this.rng);
    pest.speed *= this.plan.speedScale;
    this.pests.push(pest);
    this.spawnTimer = this.plan.interval * this.rng.range(0.7, 1.3);
  }

  // -- the Warden --------------------------------------------------------------

  updatePlayer(dt, input) {
    const p = this.player;
    const ax = input.axisX();
    const ay = input.axisY();
    const len = Math.hypot(ax, ay) || 1;
    p.x += (ax / len) * p.speed * dt * (ax || ay ? 1 : 0);
    p.y += (ay / len) * p.speed * dt * (ax || ay ? 1 : 0);
    if (ax || ay) p.walkPhase += dt * 11;
    p.x = Math.max(p.radius, Math.min(VIEW.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(VIEW.height - p.radius, p.y));
    p.aimAngle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
    if (p.iframes > 0) p.iframes -= dt;

    p.fireTimer -= dt;
    if (input.firing() && p.fireTimer <= 0) {
      this.fireBolts();
      p.fireTimer = p.fireInterval;
    }
  }

  fireBolts() {
    const p = this.player;
    const count = p.projectiles;
    const spreadStep = 0.13;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spreadStep;
      const angle = p.aimAngle + offset;
      const tipX = p.x + Math.cos(p.aimAngle) * (p.radius + 6);
      const tipY = p.y + Math.sin(p.aimAngle) * (p.radius + 6);
      const bolt = makeBolt(tipX, tipY, angle, p.boltDamage, p.pierce);
      bolt.hitSet = new Set();
      this.bolts.push(bolt);
    }
    this.sound.shoot();
  }

  damagePlayer(amount) {
    const p = this.player;
    if (p.iframes > 0 || this.state !== 'playing') return;
    p.hp -= amount;
    p.iframes = PLAYER.iframeSeconds;
    this.hurtFlash = 0.55;
    this.shake = Math.max(this.shake, 5);
    this.burst(p.x, p.y, '#ff5d73', 10);
    this.sound.hurt();
    if (p.hp <= 0) this.gameOver('The Warden has fallen. The garden goes dark.');
  }

  // -- pests --------------------------------------------------------------

  updatePests(dt) {
    for (const pest of this.pests) {
      pest.wobble += dt * 4;
      if (pest.flash > 0) pest.flash -= dt;
      if (pest.contactTimer > 0) pest.contactTimer -= dt;
      const dx = BLOOM.x - pest.x;
      const dy = BLOOM.y - pest.y;
      const distBloom = Math.hypot(dx, dy) || 1;
      const ux = dx / distBloom;
      const uy = dy / distBloom;
      const chewRange = BLOOM.radius + pest.radius * 0.7;
      let moveX = 0;
      let moveY = 0;

      if (pest.kind === 'spitter') {
        const keep = pest.def.keepDistance;
        if (distBloom > keep + 24) { moveX = ux; moveY = uy; }
        else if (distBloom < keep - 40) { moveX = -ux; moveY = -uy; }
        else { moveX = -uy * 0.45; moveY = ux * 0.45; } // slow strafe at range
        pest.sapTimer -= dt;
        if (pest.sapTimer <= 0 && distBloom < keep + 90) {
          pest.sapTimer = pest.def.sapSeconds * this.rng.range(0.85, 1.2);
          const targetPlayer = this.rng.chance(0.62);
          const t = targetPlayer ? this.player : { x: BLOOM.x, y: BLOOM.y };
          this.saps.push(makeSap(pest.x, pest.y, t.x, t.y, pest.def));
          this.sound.spit();
        }
      } else if (distBloom > chewRange) {
        moveX = ux;
        moveY = uy;
      } else {
        // Chewing the Bloom: damage on a timer, thorns bite back.
        pest.chewTimer -= dt;
        if (pest.chewTimer <= 0) {
          pest.chewTimer = pest.def.chewSeconds;
          this.damageBloom(pest.def.chewDamage);
          if (this.bloom.thornDamage > 0) this.hurtPest(pest, this.bloom.thornDamage, 0, 0, false);
        }
      }

      pest.x += (moveX * pest.speed + pest.knockX) * dt;
      pest.y += (moveY * pest.speed + pest.knockY) * dt;
      pest.knockX *= Math.exp(-9 * dt);
      pest.knockY *= Math.exp(-9 * dt);

      // A pest that bumps the Warden stings, then backs off briefly.
      const pdx = this.player.x - pest.x;
      const pdy = this.player.y - pest.y;
      const distPlayer = Math.hypot(pdx, pdy);
      if (distPlayer < pest.radius + this.player.radius && pest.contactTimer <= 0) {
        pest.contactTimer = 0.9;
        pest.knockX -= (pdx / (distPlayer || 1)) * 190;
        pest.knockY -= (pdy / (distPlayer || 1)) * 190;
        this.damagePlayer(PLAYER.contactDamage);
      }
    }
    this.pests = this.pests.filter((pest) => !pest.dead);
  }

  damageBloom(amount) {
    if (this.state !== 'playing' && this.state !== 'upgrade') return;
    this.bloom.hp -= amount;
    this.bloom.pulse = 1;
    this.shake = Math.max(this.shake, 4);
    this.burst(BLOOM.x, BLOOM.y, '#ff7d9c', 6, 90);
    this.sound.bloomHurt();
    if (this.bloom.hp <= 0) {
      this.bloom.hp = 0;
      this.gameOver('The Bloomheart was eaten. Spring will not come.');
    }
  }

  hurtPest(pest, damage, knockX, knockY, playSound = true) {
    if (pest.dead) return;
    pest.hp -= damage;
    pest.flash = 0.09;
    pest.knockX += knockX;
    pest.knockY += knockY;
    if (playSound) this.sound.hit();
    if (pest.hp > 0) return;
    pest.dead = true;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = COMBO.windowSeconds;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const gained = Math.round(pest.def.score * this.comboMult());
    this.score += gained;
    this.floaters.push(makeFloater(pest.x, pest.y - pest.radius, `+${gained}`, '#eafff5'));
    this.burst(pest.x, pest.y, pest.def.colour, pest.kind === 'brute' ? 22 : 11);
    this.sound.pop();
    if (pest.kind === 'brute') {
      for (let i = 0; i < (pest.def.splitsInto || 0); i++) {
        const child = makePest('crawler', pest.x + this.rng.range(-16, 16), pest.y + this.rng.range(-16, 16), 1, this.rng);
        child.knockX = this.rng.range(-120, 120);
        child.knockY = this.rng.range(-120, 120);
        this.pests.push(child);
      }
      this.shake = Math.max(this.shake, 5);
    }
    const roll = this.rng.next();
    if (roll < PICKUP.heartChance && this.player.hp < this.playerMaxHp) {
      this.pickups.push(makePickup('heart', pest.x, pest.y, this.rng));
    } else if (roll < PICKUP.heartChance + PICKUP.pollenChance) {
      this.pickups.push(makePickup('pollen', pest.x, pest.y, this.rng));
    }
  }

  // -- projectiles --------------------------------------------------------------

  updateBolts(dt) {
    for (const bolt of this.bolts) {
      bolt.trail.push({ x: bolt.x, y: bolt.y });
      if (bolt.trail.length > 5) bolt.trail.shift();
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0) { bolt.spent = true; continue; }
      for (const pest of this.pests) {
        if (pest.dead || bolt.hitSet.has(pest)) continue;
        const d = Math.hypot(pest.x - bolt.x, pest.y - bolt.y);
        if (d >= pest.radius + bolt.radius) continue;
        bolt.hitSet.add(pest);
        const kx = (bolt.vx / BOLT.speed) * 150;
        const ky = (bolt.vy / BOLT.speed) * 150;
        this.hurtPest(pest, bolt.damage, kx, ky);
        if (bolt.pierce > 0) { bolt.pierce -= 1; }
        else { bolt.spent = true; break; }
      }
    }
    this.bolts = this.bolts.filter((bolt) => !bolt.spent);
  }

  updateSaps(dt) {
    for (const sap of this.saps) {
      sap.x += sap.vx * dt;
      sap.y += sap.vy * dt;
      sap.life -= dt;
      if (sap.life <= 0) { sap.spent = true; continue; }
      const dBloom = Math.hypot(BLOOM.x - sap.x, BLOOM.y - sap.y);
      if (dBloom < BLOOM.radius + sap.radius) {
        sap.spent = true;
        this.damageBloom(sap.damage);
        continue;
      }
      const dPlayer = Math.hypot(this.player.x - sap.x, this.player.y - sap.y);
      if (dPlayer < this.player.radius + sap.radius) {
        sap.spent = true;
        this.damagePlayer(1);
      }
    }
    this.saps = this.saps.filter((sap) => !sap.spent);
  }

  // -- pickups, particles, floaters --------------------------------------------------------------

  updatePickups(dt) {
    for (const pickup of this.pickups) {
      pickup.age += dt;
      if (pickup.age > PICKUP.driftSeconds) { pickup.spent = true; continue; }
      const dx = this.player.x - pickup.x;
      const dy = this.player.y - pickup.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < this.player.magnetRadius) {
        const pull = 340 * (1 - dist / (this.player.magnetRadius * 1.6));
        pickup.x += (dx / dist) * pull * dt;
        pickup.y += (dy / dist) * pull * dt;
      }
      if (dist < PICKUP.collectRadius) {
        pickup.spent = true;
        this.collectPickup(pickup);
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.spent);
  }

  collectPickup(pickup) {
    if (pickup.kind === 'pollen') {
      this.bloom.hp = Math.min(this.bloom.maxHp, this.bloom.hp + PICKUP.pollenBloomHeal);
      this.score += PICKUP.pollenScore;
      this.floaters.push(makeFloater(this.player.x, this.player.y - 26, `+${PICKUP.pollenBloomHeal} Bloom`, '#ffd166'));
    } else {
      this.player.hp = Math.min(this.playerMaxHp, this.player.hp + 1);
      this.floaters.push(makeFloater(this.player.x, this.player.y - 26, '+1 Health', '#ff8fa8'));
    }
    this.burst(pickup.x, pickup.y, '#ffd166', 7, 80);
    this.sound.pickup();
  }

  burst(x, y, colour, count, speed) {
    for (let i = 0; i < count; i++) {
      this.particles.push(makeParticle(x, y, colour, this.rng, speed));
    }
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-2.4 * dt);
      particle.vy *= Math.exp(-2.4 * dt);
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  updateFloaters(dt) {
    for (const floater of this.floaters) {
      floater.y -= 34 * dt;
      floater.life -= dt;
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
  }
}
