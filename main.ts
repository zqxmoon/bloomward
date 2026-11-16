// Bloomward's handover program (Node 22, standard library only).
//
// The game itself is the static site in game/ — index.html and its ES
// modules, no build step, nothing fetched. This program's whole job is to
// hand it in: copy game/ and screenshots/ into the output directory and
// write dossier.json there with the vendored make.fun library, under the
// same caps the bounty scorer enforces, so an entry the scorer would
// refuse fails here first instead.
//
// In the grader the output directory is /output; anywhere else,
// MAKEFUN_OUTPUT_DIR names it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// The scorer's caps, mirrored so this program refuses what it would.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
  const shotsFrom = join(repoDir, 'screenshots');
  if (existsSync(shotsFrom)) {
    cpSync(shotsFrom, join(outputDir, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
