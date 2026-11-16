// main.js — Bloomward's entry point. Wires the canvas, input, sound and the
// game together and runs the frame loop. A "?stage=" address parameter
// builds a frozen, seeded scene instead (title, play, upgrade or over) so
// the screenshots in /screenshots are honest renders of these very files,
// taken in a browser with no hand on the controls.

import { SoundBank } from './audio.js';
import { BLOOM } from './config.js';
import { makeBolt, makeFloater, makePickup, makePest } from './entities.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { createRenderer } from './render.js';
import { makeRng } from './rng.js';
import { UPGRADES } from './upgrades.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const stage = params.get('stage');
const seed = Number(params.get('seed')) || 20261116;

const rng = makeRng(stage ? seed : (Date.now() % 2147483646) + 1);
const sound = new SoundBank();
const input = new Input(canvas);
const game = new Game(rng, sound);
const renderer = createRenderer(canvas);

window.addEventListener('pointerdown', () => sound.unlock());
window.addEventListener('keydown', () => sound.unlock());

if (stage) buildStageScene(stage, game, rng);
game.time = stage ? 12.5 : 0;

let lastStamp = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - lastStamp) / 1000);
  lastStamp = now;
  if (!stage) game.update(dt, input);
  renderer.render(game, input);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// -- frozen scenes for the screenshots -------------------------------------

function buildStageScene(which, g, rng) {
  g.resetField();
  if (which === 'title') {
    g.state = 'title';
    g.best = 2380;
    scatterDecorPests(g, rng);
    return;
  }
  if (which === 'play') {
    g.state = 'playing';
    g.wave = 3;
    g.score = 1240;
    g.kills = 41;
    g.combo = 7;
    g.comboTimer = 1.8;
    g.bestCombo = 11;
    g.bloom.hp = 76;
    g.player.hp = 5;
    g.player.x = 430;
    g.player.y = 528;
    g.player.aimAngle = Math.atan2(300 - 528, 760 - 430);
    place(g, 'crawler', 760, 300, rng);
    place(g, 'crawler', 828, 388, rng);
    place(g, 'dart', 980, 210, rng);
    place(g, 'dart', 250, 190, rng);
    place(g, 'spitter', 905, 560, rng);
    place(g, 'brute', 180, 560, rng);
    g.spawnQueue = ['crawler', 'dart', 'crawler', 'spitter', 'crawler', 'dart'];
    for (let i = 0; i < 3; i++) {
      const a = g.player.aimAngle + (i - 1) * 0.05;
      const bolt = makeBolt(430 + Math.cos(a) * (60 + i * 70), 528 + Math.sin(a) * (60 + i * 70), a, 1, 0);
      bolt.trail = [{ x: bolt.x - Math.cos(a) * 26, y: bolt.y - Math.sin(a) * 26 }];
      g.bolts.push(bolt);
    }
    g.pickups.push(makePickup('pollen', 560, 330, rng));
    g.pickups.push(makePickup('pollen', 700, 620, rng));
    g.pickups.push(makePickup('heart', 340, 300, rng));
    g.floaters.push(makeFloater(760, 262, '+15', '#eafff5'));
    g.burst(828, 388, '#f2a541', 8);
    return;
  }
  if (which === 'upgrade') {
    g.state = 'upgrade';
    g.wave = 2;
    g.score = 860;
    g.kills = 23;
    g.bloom.hp = 64;
    g.player.hp = 4;
    g.player.x = BLOOM.x;
    g.player.y = BLOOM.y + 130;
    const wanted = ['split', 'heavy', 'mend'];
    g.choices = UPGRADES.filter((u) => wanted.includes(u.id));
    g.burst(BLOOM.x, BLOOM.y, '#ffd166', 14);
    return;
  }
  if (which === 'over') {
    g.state = 'over';
    g.wave = 6;
    g.score = 2380;
    g.best = 2380;
    g.kills = 87;
    g.bestCombo = 14;
    g.combo = 0;
    g.bloom.hp = 0;
    g.player.hp = 2;
    g.overReason = 'The Bloomheart was eaten. Spring will not come.';
    place(g, 'crawler', BLOOM.x - 52, BLOOM.y + 20, rng);
    place(g, 'crawler', BLOOM.x + 60, BLOOM.y - 26, rng);
    place(g, 'brute', BLOOM.x + 150, BLOOM.y + 90, rng);
    place(g, 'dart', 300, 240, rng);
    return;
  }
  g.state = 'title';
}

function place(g, kind, x, y, rng) {
  const pest = makePest(kind, x, y, 1.3, rng);
  g.pests.push(pest);
  return pest;
}

function scatterDecorPests(g, rng) {
  place(g, 'crawler', 150, 620, rng);
  place(g, 'dart', 1120, 150, rng);
  place(g, 'spitter', 1080, 640, rng);
}
