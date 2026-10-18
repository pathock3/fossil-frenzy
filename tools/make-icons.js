#!/usr/bin/env node
// Draws the Tabletop Library icon (a fossil tile with an ammonite spiral) and writes assets/icon.svg plus the PNGs
// that iPad Safari uses for Favorites and the Home Screen.   node tools/make-icons.js   (needs Playwright; only run when the design changes)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const hex = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return (cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1); }).join(' ');
// spiral: a growing curve around the centre, drawn as one thick rounded line
const spiral = (cx, cy, turns, rMax) => {
  const pts = []; const steps = 120;
  for (let i = 0; i <= steps; i++) { const t = i / steps, a = t * turns * 2 * Math.PI - Math.PI / 2, r = 4 + t * (rMax - 4); pts.push((cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1)); }
  return 'M' + pts.join(' L');
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
<defs><radialGradient id="g" cx="50%" cy="0%" r="110%"><stop offset="0" stop-color="#4a2e1a"/><stop offset="1" stop-color="#1b130e"/></radialGradient></defs>
<rect width="180" height="180" fill="url(#g)"/>
<polygon points="${hex(90, 90, 74)}" fill="#d9953a" stroke="#f1c27a" stroke-width="3"/>
<polygon points="${hex(90, 90, 62)}" fill="#f6e7b8" stroke="#c9ae6a" stroke-width="3"/>
<path d="${spiral(90, 90, 2.6, 43)}" fill="none" stroke="#4a2e1c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const root = path.join(__dirname, '..', 'assets');
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'icon.svg'), svg);

const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
(async () => {
  const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const [file, size] of [['apple-touch-icon.png', 180], ['favicon.png', 64], ['icon-512.png', 512]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body>`);
    await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(root, file) });
  }
  await b.close();
  console.log('icons written to assets/');
})();
