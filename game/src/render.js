// render.js — everything Bloomward draws, and nothing else. The ground is
// pre-rendered once to an offscreen canvas (speckled turf, a ring of
// stepping stones, the Bloom's pool of light); each frame then paints
// pickups, the Bloom, pests, the Warden, bolts, particles and floating
// text, and finally the HUD or the current screen (title, upgrade cards,
// pause, game over). Buttons drawn here record their rectangles on
// game.ui so game.js can answer clicks.

import { BLOOM, PALETTE, VIEW } from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const ground = prerenderGround();
  let bloomPulseSeen = 0;
  let lastBloomHp = BLOOM.maxHp;

  function render(game, input) {
    ctx.save();
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }
    ctx.drawImage(ground, 0, 0);
    drawPickups(ctx, game);
    if (game.bloom.hp < lastBloomHp) bloomPulseSeen = 1;
    lastBloomHp = game.bloom.hp;
    bloomPulseSeen = Math.max(0, bloomPulseSeen - 0.03);
    drawBloom(ctx, game, bloomPulseSeen);
    drawSaps(ctx, game);
    drawPests(ctx, game);
    if (game.state !== 'title') drawPlayer(ctx, game);
    drawBolts(ctx, game);
    drawParticles(ctx, game);
    drawFloaters(ctx, game);
    ctx.restore();

    game.ui.buttons = {};
    game.ui.cards = [];
    if (game.state === 'title') drawTitleScreen(ctx, game);
    else {
      drawHud(ctx, game);
      if (game.state === 'upgrade') drawUpgradeScreen(ctx, game);
      if (game.state === 'paused') drawPausedScreen(ctx, game);
      if (game.state === 'over') drawGameOverScreen(ctx, game);
      if (game.state === 'playing') drawAimCursor(ctx, input);
    }
    if (game.banner.timer > 0 && game.state === 'playing') drawWaveBanner(ctx, game);
    if (game.hurtFlash > 0) drawHurtVignette(ctx, game);
  }

  return { render };
}

// -- the garden floor ---------------------------------------------------------

function prerenderGround() {
  const off = document.createElement('canvas');
  off.width = VIEW.width;
  off.height = VIEW.height;
  const g = off.getContext('2d');
  const grad = g.createRadialGradient(BLOOM.x, BLOOM.y, 60, BLOOM.x, BLOOM.y, 760);
  grad.addColorStop(0, '#0f3a30');
  grad.addColorStop(0.55, PALETTE.groundDeep);
  grad.addColorStop(1, PALETTE.groundEdge);
  g.fillStyle = grad;
  g.fillRect(0, 0, VIEW.width, VIEW.height);

  // Turf speckles, scattered with a fixed seed so every garden is the same.
  let s = 1234567;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rand() < 0.5 ? PALETTE.groundSpeck : PALETTE.groundSpeckDim;
    g.globalAlpha = 0.12 + rand() * 0.25;
    const x = rand() * VIEW.width;
    const y = rand() * VIEW.height;
    g.fillRect(x, y, 2.4, 2.4 + rand() * 3);
  }
  g.globalAlpha = 1;

  // The Bloom's pool of light.
  const light = g.createRadialGradient(BLOOM.x, BLOOM.y, 10, BLOOM.x, BLOOM.y, BLOOM.glowRadius);
  light.addColorStop(0, 'rgba(255, 209, 102, 0.20)');
  light.addColorStop(1, 'rgba(255, 209, 102, 0)');
  g.fillStyle = light;
  g.fillRect(BLOOM.x - BLOOM.glowRadius, BLOOM.y - BLOOM.glowRadius, BLOOM.glowRadius * 2, BLOOM.glowRadius * 2);

  // A ring of flat stepping stones around the Bloom.
  g.fillStyle = PALETTE.ringStone;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = BLOOM.x + Math.cos(a) * (BLOOM.radius + 44);
    const y = BLOOM.y + Math.sin(a) * (BLOOM.radius + 44);
    g.beginPath();
    g.ellipse(x, y, 13, 9, a, 0, Math.PI * 2);
    g.fill();
  }
  return off;
}

// -- living things ---------------------------------------------------------

function drawBloom(ctx, game, pulse) {
  const { hp, maxHp } = game.bloom;
  const health = hp / maxHp;
  const breathe = 1 + Math.sin(game.time * 1.7) * 0.03 + pulse * 0.12;
  ctx.save();
  ctx.translate(BLOOM.x, BLOOM.y);
  // Leaves at the base.
  ctx.fillStyle = PALETTE.bloomLeaf;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(BLOOM.radius * 0.95, 0, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Petals: two rings turning slowly against each other. A hurt Bloom
  // wilts — petals shrink and grey as health falls.
  const wilt = 0.55 + health * 0.45;
  drawPetalRing(ctx, 8, BLOOM.radius * 1.02 * breathe * wilt, game.time * 0.12, PALETTE.bloomPetalDeep, health);
  drawPetalRing(ctx, 6, BLOOM.radius * 0.72 * breathe * wilt, -game.time * 0.17, PALETTE.bloomPetal, health);
  // The golden heart.
  ctx.fillStyle = PALETTE.bloomHeart;
  ctx.beginPath();
  ctx.arc(0, 0, BLOOM.radius * 0.34 * breathe, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.beginPath();
  ctx.arc(-4, -5, BLOOM.radius * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPetalRing(ctx, count, radius, rotation, colour, health) {
  ctx.save();
  ctx.globalAlpha = 0.45 + health * 0.55;
  ctx.fillStyle = colour;
  for (let i = 0; i < count; i++) {
    const a = rotation + (i / count) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(radius * 0.62, 0, radius * 0.52, radius * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.iframes > 0 && Math.floor(game.time * 14) % 2 === 0 && game.state === 'playing') {
    ctx.save();
    ctx.globalAlpha = 0.45;
  } else {
    ctx.save();
  }
  ctx.translate(p.x, p.y);
  const bob = Math.sin(p.walkPhase) * 1.6;
  // Cloak: a rounded triangle trailing below the body.
  ctx.fillStyle = PALETTE.wardenCloakDeep;
  ctx.beginPath();
  ctx.moveTo(-11, 4 + bob * 0.3);
  ctx.quadraticCurveTo(0, 24 + bob, 11, 4 + bob * 0.3);
  ctx.closePath();
  ctx.fill();
  // Body and hood.
  ctx.fillStyle = PALETTE.wardenCloak;
  ctx.beginPath();
  ctx.arc(0, bob * 0.4, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.wardenSkin;
  ctx.beginPath();
  ctx.arc(0, -3 + bob * 0.4, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The wand arm points at the aim; its tip glows.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aimAngle);
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(6, 4);
  ctx.lineTo(p.radius + 7, 1);
  ctx.stroke();
  ctx.fillStyle = PALETTE.boltCore;
  ctx.beginPath();
  ctx.arc(p.radius + 8, 1, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPests(ctx, game) {
  for (const pest of game.pests) {
    ctx.save();
    ctx.translate(pest.x, pest.y);
    const facing = Math.atan2(BLOOM.y - pest.y, BLOOM.x - pest.x);
    ctx.rotate(facing);
    const fill = pest.flash > 0 ? '#ffffff' : pest.def.colour;
    const deep = pest.flash > 0 ? '#ffffff' : pest.def.colourDeep;
    if (pest.kind === 'crawler') drawCrawler(ctx, pest, fill, deep);
    else if (pest.kind === 'dart') drawDart(ctx, pest, fill, deep);
    else if (pest.kind === 'spitter') drawSpitter(ctx, pest, fill, deep);
    else drawBrute(ctx, pest, fill, deep);
    ctx.restore();
    if (pest.hp < pest.maxHp) drawPestHealth(ctx, pest);
  }
}

function drawCrawler(ctx, pest, fill, deep) {
  // Six legs scuttling, an oval body, two mandibles toward the Bloom.
  ctx.strokeStyle = deep;
  ctx.lineWidth = 2.4;
  for (let i = -1; i <= 1; i++) {
    const sway = Math.sin(pest.wobble * 3 + i * 1.4) * 3;
    ctx.beginPath();
    ctx.moveTo(i * 6, -6);
    ctx.lineTo(i * 6 + sway, -pest.radius - 3);
    ctx.moveTo(i * 6, 6);
    ctx.lineTo(i * 6 - sway, pest.radius + 3);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, pest.radius, pest.radius * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.arc(pest.radius * 0.45, 0, pest.radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  drawEyes(ctx, pest.radius * 0.55, 3.4);
}

function drawDart(ctx, pest, fill, deep) {
  // A slim moth: swept wings beating fast, a needle body.
  const beat = Math.sin(pest.wobble * 6) * 0.5;
  ctx.fillStyle = deep;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.7 + beat * 0.4));
    ctx.beginPath();
    ctx.ellipse(-4, side * pest.radius * 0.9, pest.radius * 1.05, pest.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, pest.radius * 1.15, pest.radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  drawEyes(ctx, pest.radius * 0.7, 2.6);
}

function drawSpitter(ctx, pest, fill, deep) {
  // Round sac body with a snout that swells before it spits.
  const swell = 1 + Math.max(0, 1 - pest.sapTimer / (pest.def.sapSeconds || 2.4)) * 0.25;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, pest.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.arc(-pest.radius * 0.3, -pest.radius * 0.25, pest.radius * 0.34, 0, Math.PI * 2);
  ctx.arc(pest.radius * 0.15, pest.radius * 0.4, pest.radius * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9f29b';
  ctx.beginPath();
  ctx.ellipse(pest.radius * 0.95, 0, 7 * swell, 5 * swell, 0, 0, Math.PI * 2);
  ctx.fill();
  drawEyes(ctx, pest.radius * 0.3, 3);
}

function drawBrute(ctx, pest, fill, deep) {
  // A plated beetle: layered shell arcs, a horn, legs like oars.
  ctx.strokeStyle = deep;
  ctx.lineWidth = 4;
  for (let i = -1; i <= 1; i++) {
    const sway = Math.sin(pest.wobble * 1.6 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(i * 12, -pest.radius * 0.7);
    ctx.lineTo(i * 12 + sway, -pest.radius - 6);
    ctx.moveTo(i * 12, pest.radius * 0.7);
    ctx.lineTo(i * 12 - sway, pest.radius + 6);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, pest.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = deep;
  ctx.lineWidth = 3;
  for (const r of [0.72, 0.45]) {
    ctx.beginPath();
    ctx.arc(0, 0, pest.radius * r, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, pest.radius * r, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(pest.radius * 0.8, -5);
  ctx.lineTo(pest.radius + 10, 0);
  ctx.lineTo(pest.radius * 0.8, 5);
  ctx.closePath();
  ctx.fill();
  drawEyes(ctx, pest.radius * 0.55, 4);
}

function drawEyes(ctx, x, size) {
  ctx.fillStyle = '#10151a';
  ctx.beginPath();
  ctx.arc(x, -size, size * 0.62, 0, Math.PI * 2);
  ctx.arc(x, size, size * 0.62, 0, Math.PI * 2);
  ctx.fill();
}

function drawPestHealth(ctx, pest) {
  const w = pest.radius * 1.7;
  const ratio = Math.max(0, pest.hp / pest.maxHp);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(pest.x - w / 2, pest.y - pest.radius - 11, w, 4.5);
  ctx.fillStyle = ratio > 0.4 ? '#7be495' : PALETTE.danger;
  ctx.fillRect(pest.x - w / 2, pest.y - pest.radius - 11, w * ratio, 4.5);
}

function drawBolts(ctx, game) {
  for (const bolt of game.bolts) {
    ctx.strokeStyle = 'rgba(255, 233, 163, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < bolt.trail.length; i++) {
      const t = bolt.trail[i];
      if (i === 0) ctx.moveTo(t.x, t.y);
      else ctx.lineTo(t.x, t.y);
    }
    ctx.lineTo(bolt.x, bolt.y);
    ctx.stroke();
    ctx.fillStyle = PALETTE.bolt;
    ctx.beginPath();
    ctx.ellipse(bolt.x, bolt.y, 7, 4, Math.atan2(bolt.vy, bolt.vx), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.boltCore;
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSaps(ctx, game) {
  for (const sap of game.saps) {
    ctx.fillStyle = PALETTE.sap;
    ctx.beginPath();
    ctx.arc(sap.x, sap.y, sap.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(sap.x - 2, sap.y - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups(ctx, game) {
  for (const pickup of game.pickups) {
    const bob = Math.sin(pickup.bobPhase + game.time * 3) * 3;
    const fade = pickup.age > 11 ? 0.45 + 0.3 * Math.sin(game.time * 10) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(pickup.x, pickup.y + bob);
    if (pickup.kind === 'pollen') {
      ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.arc(-6, -4, 4, 0, Math.PI * 2);
      ctx.arc(6, -3, 4.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawHeart(ctx, 0, 0, 9, '#ff8fa8');
    }
    ctx.restore();
  }
}

function drawHeart(ctx, x, y, size, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.85);
  ctx.bezierCurveTo(-size * 1.25, -size * 0.1, -size * 0.7, -size * 1.05, 0, -size * 0.35);
  ctx.bezierCurveTo(size * 0.7, -size * 1.05, size * 1.25, -size * 0.1, 0, size * 0.85);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, game) {
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.colour;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, game) {
  ctx.textAlign = 'center';
  ctx.font = '700 17px Verdana, Geneva, sans-serif';
  for (const floater of game.floaters) {
    ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
    ctx.fillStyle = floater.colour;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.globalAlpha = 1;
}

// -- HUD and screens ---------------------------------------------------------

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panelFill;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
}

function drawHud(ctx, game) {
  // Top-left: wave, score, pests remaining.
  panel(ctx, 16, 14, 252, 96);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.textMain;
  ctx.font = '800 25px Verdana, Geneva, sans-serif';
  ctx.fillText(`WAVE ${Math.max(1, game.wave)}`, 32, 48);
  ctx.font = '700 19px Verdana, Geneva, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`Score ${game.score}`, 32, 76);
  ctx.font = '600 14px Verdana, Geneva, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  const left = game.spawnQueue.length + game.pests.length;
  ctx.fillText(game.state === 'upgrade' ? 'Wave cleared!' : `Pests left: ${left}`, 32, 98);

  // Top-centre: the combo meter while a streak is alive.
  if (game.combo >= 2 && game.state === 'playing') {
    const w = 250;
    panel(ctx, VIEW.width / 2 - w / 2, 14, w, 58);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '800 21px Verdana, Geneva, sans-serif';
    const pct = Math.round((game.comboMult() - 1) * 100);
    ctx.fillText(`COMBO x${game.combo}  +${pct}%`, VIEW.width / 2, 42);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.fillRect(VIEW.width / 2 - w / 2 + 14, 52, w - 28, 6);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(VIEW.width / 2 - w / 2 + 14, 52, (w - 28) * Math.max(0, game.comboTimer / 2.6), 6);
  }

  // Top-right: sound and pause hints.
  ctx.textAlign = 'right';
  ctx.font = '600 14px Verdana, Geneva, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(game.sound.muted ? 'M — sound off' : 'M — sound on', VIEW.width - 24, 36);
  ctx.fillText('P — pause', VIEW.width - 24, 58);

  // Bottom-left: Warden health pips.
  ctx.textAlign = 'left';
  ctx.font = '700 14px Verdana, Geneva, sans-serif';
  ctx.fillStyle = PALETTE.textMain;
  ctx.fillText('WARDEN', 24, VIEW.height - 44);
  for (let i = 0; i < game.playerMaxHp; i++) {
    ctx.beginPath();
    ctx.arc(34 + i * 25, VIEW.height - 24, 8.5, 0, Math.PI * 2);
    if (i < game.player.hp) {
      ctx.fillStyle = '#ff8fa8';
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255, 143, 168, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Bottom-right: the Bloom's health bar.
  const barW = 300;
  const barX = VIEW.width - barW - 24;
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textMain;
  ctx.fillText(`BLOOM ${Math.max(0, Math.ceil(game.bloom.hp))} / ${game.bloom.maxHp}`, VIEW.width - 24, VIEW.height - 44);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(barX, VIEW.height - 36, barW, 14, 7);
  ctx.fill();
  const ratio = Math.max(0, game.bloom.hp / game.bloom.maxHp);
  ctx.fillStyle = ratio > 0.35 ? PALETTE.bloomPetal : PALETTE.danger;
  ctx.beginPath();
  ctx.roundRect(barX, VIEW.height - 36, barW * ratio, 14, 7);
  ctx.fill();
}

function drawAimCursor(ctx, input) {
  ctx.strokeStyle = 'rgba(234, 255, 245, 0.8)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(input.mouse.x, input.mouse.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(234, 255, 245, 0.9)';
  ctx.fillRect(input.mouse.x - 1, input.mouse.y - 1, 2, 2);
}

function drawWaveBanner(ctx, game) {
  const alpha = Math.min(1, game.banner.timer / 0.6, (2.2 - game.banner.timer) / 0.4 + 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.textMain;
  ctx.font = '800 54px Verdana, Geneva, sans-serif';
  ctx.fillText(game.banner.text, VIEW.width / 2, 168);
  if (game.banner.sub) {
    ctx.font = '600 21px Verdana, Geneva, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(game.banner.sub, VIEW.width / 2, 204);
  }
  ctx.restore();
}

function drawHurtVignette(ctx, game) {
  const grad = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, 260, VIEW.width / 2, VIEW.height / 2, 720);
  grad.addColorStop(0, 'rgba(255, 60, 80, 0)');
  grad.addColorStop(1, `rgba(255, 60, 80, ${0.4 * game.hurtFlash})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawButton(ctx, game, name, x, y, w, h, label, primary) {
  game.ui.buttons[name] = { x, y, w, h };
  ctx.fillStyle = primary ? PALETTE.wardenCloak : 'rgba(10, 40, 34, 0.92)';
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = primary ? '#06382b' : PALETTE.textMain;
  ctx.font = '800 21px Verdana, Geneva, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
}

function dimGarden(ctx, alpha) {
  ctx.fillStyle = `rgba(3, 14, 12, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function drawTitleScreen(ctx, game) {
  dimGarden(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.bloomPetal;
  ctx.font = '800 92px Verdana, Geneva, sans-serif';
  ctx.fillText('BLOOMWARD', VIEW.width / 2, 148);
  ctx.fillStyle = PALETTE.textMain;
  ctx.font = '600 22px Verdana, Geneva, sans-serif';
  ctx.fillText('The last Bloomheart is waking — and every pest in the valley can smell it.', VIEW.width / 2, 190);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 18px Verdana, Geneva, sans-serif';
  ctx.fillText('You are its Warden. Hold the garden, wave after wave.', VIEW.width / 2, 220);

  panel(ctx, VIEW.width / 2 - 330, 258, 660, 218);
  ctx.fillStyle = PALETTE.textMain;
  ctx.font = '700 19px Verdana, Geneva, sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW.width / 2, 292);
  ctx.font = '600 17.5px Verdana, Geneva, sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  const lines = [
    'Move — WASD or arrow keys      Aim — mouse',
    'Fire — hold the mouse button, or hold Space',
    'Pests chew the Bloom at the centre: stop them first.',
    'Grab golden pollen to mend the Bloom; hearts mend you.',
    'Clear a wave, then choose 1 of 3 blessings to grow stronger.',
    'The run ends when the Bloom falls — or you do.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 328 + i * 26));

  drawButton(ctx, game, 'start', VIEW.width / 2 - 120, 512, 240, 58, 'START  (Enter)', true);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '700 18px Verdana, Geneva, sans-serif';
  ctx.fillText(game.best > 0 ? `Best score: ${game.best}` : 'Survive as many waves as you can. Good luck, Warden.', VIEW.width / 2, 616);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 14px Verdana, Geneva, sans-serif';
  ctx.fillText('P pauses · M mutes · A gamepad is not required, courage is', VIEW.width / 2, 648);
}

const GLYPH_DRAWERS = {
  rapid: (ctx) => { for (let i = 0; i < 3; i++) drawChevron(ctx, -16 + i * 15, 0); },
  heavy: (ctx) => drawSeedIcon(ctx, 0, 0, 17),
  split: (ctx) => { drawSeedIcon(ctx, -16, 8, 9); drawSeedIcon(ctx, 0, -10, 9); drawSeedIcon(ctx, 16, 8, 9); },
  pierce: (ctx) => {
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(16, 0); ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.moveTo(16, -7); ctx.lineTo(28, 0); ctx.lineTo(16, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PALETTE.bloomPetal; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(4, 0, 12, 0, Math.PI * 2); ctx.stroke();
  },
  swift: (ctx) => {
    ctx.fillStyle = PALETTE.wardenCloak;
    ctx.beginPath();
    ctx.moveTo(-22, 10); ctx.quadraticCurveTo(6, 14, 24, 10); ctx.lineTo(24, 2);
    ctx.quadraticCurveTo(2, -4, -12, -12); ctx.quadraticCurveTo(-24, -2, -22, 10);
    ctx.closePath(); ctx.fill();
  },
  heart: (ctx) => drawHeart(ctx, 0, 4, 17, '#ff8fa8'),
  mend: (ctx) => {
    ctx.fillStyle = PALETTE.bloomPetal;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 11, Math.sin(a) * 11, 9, 5.4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  },
  magnet: (ctx) => {
    ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, -2, 14, Math.PI * 0.95, Math.PI * 2.05); ctx.stroke();
    ctx.strokeStyle = '#e8f4ff';
    ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-14, -4); ctx.moveTo(14, -16); ctx.lineTo(14, -4); ctx.stroke();
  },
  thorns: (ctx) => {
    ctx.fillStyle = PALETTE.bloomLeaf;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(0, -24); ctx.lineTo(4, -8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = PALETTE.bloomPetal;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  },
};

function drawChevron(ctx, x, y) {
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 11);
  ctx.lineTo(x + 6, y);
  ctx.lineTo(x - 6, y + 11);
  ctx.stroke();
}

function drawSeedIcon(ctx, x, y, r) {
  ctx.fillStyle = PALETTE.bolt;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.boltCore;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawUpgradeScreen(ctx, game) {
  dimGarden(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.textMain;
  ctx.font = '800 40px Verdana, Geneva, sans-serif';
  ctx.fillText(`Wave ${game.wave} cleared!`, VIEW.width / 2, 148);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '600 20px Verdana, Geneva, sans-serif';
  ctx.fillText('Choose a blessing for the Warden', VIEW.width / 2, 184);

  const cardW = 300;
  const cardH = 320;
  const gap = 28;
  const totalW = cardW * 3 + gap * 2;
  const startX = (VIEW.width - totalW) / 2;
  const cardY = 226;
  game.choices.forEach((choice, i) => {
    const x = startX + i * (cardW + gap);
    game.ui.cards[i] = { x, y: cardY, w: cardW, h: cardH };
    ctx.fillStyle = 'rgba(8, 42, 35, 0.97)';
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(x + cardW / 2, cardY + 74);
    const drawer = GLYPH_DRAWERS[choice.glyph] || GLYPH_DRAWERS.heavy;
    drawer(ctx);
    ctx.restore();
    ctx.fillStyle = PALETTE.textMain;
    ctx.font = '800 24px Verdana, Geneva, sans-serif';
    wrapText(ctx, choice.name, x + cardW / 2, cardY + 148, cardW - 40, 28);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 17px Verdana, Geneva, sans-serif';
    wrapText(ctx, choice.blurb, x + cardW / 2, cardY + 196, cardW - 44, 23);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '800 17px Verdana, Geneva, sans-serif';
    ctx.fillText(`Press ${i + 1} or click`, x + cardW / 2, cardY + cardH - 24);
  });
}

function drawPausedScreen(ctx, game) {
  dimGarden(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.textMain;
  ctx.font = '800 52px Verdana, Geneva, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 330);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 18px Verdana, Geneva, sans-serif';
  ctx.fillText('The garden holds its breath.', VIEW.width / 2, 368);
  drawButton(ctx, game, 'resume', VIEW.width / 2 - 110, 404, 220, 54, 'RESUME  (P)', true);
}

function drawGameOverScreen(ctx, game) {
  dimGarden(ctx, 0.68);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.danger;
  ctx.font = '800 60px Verdana, Geneva, sans-serif';
  ctx.fillText('THE GARDEN FALLS', VIEW.width / 2, 168);
  ctx.fillStyle = PALETTE.textMain;
  ctx.font = '600 20px Verdana, Geneva, sans-serif';
  ctx.fillText(game.overReason, VIEW.width / 2, 208);

  panel(ctx, VIEW.width / 2 - 240, 248, 480, 208);
  const rows = [
    ['Final score', game.score],
    ['Best score', game.best],
    ['Waves survived', game.wave],
    ['Pests popped', game.kills],
    ['Best combo', `x${game.bestCombo}`],
  ];
  rows.forEach(([label, value], i) => {
    const y = 292 + i * 38;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 19px Verdana, Geneva, sans-serif';
    ctx.fillText(label, VIEW.width / 2 - 200, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '800 21px Verdana, Geneva, sans-serif';
    ctx.fillText(String(value), VIEW.width / 2 + 200, y);
  });

  drawButton(ctx, game, 'restart', VIEW.width / 2 - 232, 492, 220, 56, 'RESTART  (Enter)', true);
  drawButton(ctx, game, 'title', VIEW.width / 2 + 12, 492, 220, 56, 'TITLE', false);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '600 15px Verdana, Geneva, sans-serif';
  ctx.fillText('Every spring, the Bloom tries again. So can you.', VIEW.width / 2, 592);
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  return lines.length;
}
