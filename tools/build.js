#!/usr/bin/env node
// Builds the deployable site into _site/: the library's index.html plus games/<id>/index.html for every game,
// each stamped with the commit, date and branch it came from.   node tools/build.js [outDir]
// `npm run build` runs the tests first, so a failing test stops a deploy.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, '_site'));
const sh = cmd => { try { return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };

// Cloudflare Workers Builds provides these; locally fall back to git.
const sha = (process.env.WORKERS_CI_COMMIT_SHA || sh('git rev-parse HEAD') || '').slice(0, 7) || 'unknown';
let branch = process.env.WORKERS_CI_BRANCH || sh('git rev-parse --abbrev-ref HEAD');
if (branch === 'HEAD') branch = '';
const date = new Date().toISOString().slice(0, 10);
const label = [sha, date, branch && branch !== 'main' ? 'preview: ' + branch : ''].filter(Boolean).join(' · ');

const gamesDir = path.join(root, 'games');
const games = fs.existsSync(gamesDir) ? fs.readdirSync(gamesDir).filter(d => fs.existsSync(path.join(gamesDir, d, 'index.html'))).sort() : [];
const pages = ['index.html', ...games.map(g => path.join('games', g, 'index.html'))];

fs.rmSync(out, { recursive: true, force: true });
for (const rel of pages) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  if (!html.includes('content="__BUILD__"')) throw new Error(rel + ' is missing the <meta name="build" content="__BUILD__"> placeholder');
  fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
  fs.writeFileSync(path.join(out, rel), html.replace('content="__BUILD__"', 'content="' + label.replace(/"/g, '') + '"'));
}
console.log('built', pages.length, 'pages into', path.relative(root, out) || '.', '—', label);
