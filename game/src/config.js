// config.js — every tuning number and colour of Bloomward in one place.
// The render and simulation files read from here so the game's balance and
// its night-garden palette can be retuned without hunting through logic.

export const VIEW = {
  width: 1280,
  height: 800,
};

// The Bloomheart sits at the centre of the garden; everything orbits it.
export const BLOOM = {
  x: VIEW.width / 2,
  y: VIEW.height / 2 + 16,
  radius: 34,          // pests stop and chew at this distance
  maxHp: 100,
  glowRadius: 190,     // soft light the garden is lit by
};

export const PLAYER = {
  radius: 15,
  baseSpeed: 265,      // px per second
  maxHp: 6,
  iframeSeconds: 0.7,  // mercy invulnerability after a hit
  contactDamage: 1,
};

export const BOLT = {
  radius: 5,
  speed: 640,
  lifeSeconds: 0.9,
  baseDamage: 1,
  baseInterval: 0.21,  // seconds between shots while firing
};

export const COMBO = {
  windowSeconds: 2.6,  // keep killing inside this to hold the combo
  maxCounted: 24,      // combo counted toward the score multiplier
  perStep: 0.06,       // multiplier grows by this per combo point
};

export const PICKUP = {
  radius: 9,
  pollenChance: 0.34,  // dropped by a dying pest
  heartChance: 0.045,
  pollenBloomHeal: 2,
  pollenScore: 15,
  baseMagnetRadius: 74,
  collectRadius: 26,
  driftSeconds: 14,    // pickups fade after this long
};

// Night-garden palette: deep teal ground, mint warden, coral Bloom,
// amber and violet pests. One family of colours everywhere.
export const PALETTE = {
  groundDeep: '#0a2622',
  groundEdge: '#061714',
  groundSpeck: '#11443a',
  groundSpeckDim: '#0d352d',
  ringStone: '#1d5a4a',
  bloomPetal: '#ff7d9c',
  bloomPetalDeep: '#e14e77',
  bloomHeart: '#ffd166',
  bloomLeaf: '#3fae7c',
  wardenCloak: '#2fd4a7',
  wardenCloakDeep: '#17a37e',
  wardenSkin: '#ffe3c2',
  bolt: '#ffe9a3',
  boltCore: '#fff7d6',
  sap: '#9be15d',
  textMain: '#eafff5',
  textDim: '#9fd8c3',
  panelFill: 'rgba(6, 32, 27, 0.88)',
  panelEdge: '#2fd4a7',
  danger: '#ff5d73',
  gold: '#ffd166',
};

export const PEST_KINDS = {
  crawler: {
    radius: 14, hp: 3, speed: 58, chewDamage: 2, chewSeconds: 0.85,
    score: 10, colour: '#f2a541', colourDeep: '#b97a24', label: 'Crawler',
  },
  dart: {
    radius: 10, hp: 2, speed: 138, chewDamage: 1, chewSeconds: 0.6,
    score: 15, colour: '#b388ff', colourDeep: '#7c4dff', label: 'Dart Moth',
  },
  spitter: {
    radius: 13, hp: 4, speed: 46, chewDamage: 1, chewSeconds: 1,
    score: 25, colour: '#8fd14f', colourDeep: '#558b2f', label: 'Sap Spitter',
    keepDistance: 268, sapSeconds: 2.4, sapDamage: 3, sapSpeed: 235,
  },
  brute: {
    radius: 27, hp: 15, speed: 33, chewDamage: 5, chewSeconds: 1.1,
    score: 40, colour: '#ef6461', colourDeep: '#a63a38', label: 'Brute Beetle',
    splitsInto: 2,
  },
};
