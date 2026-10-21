// The quick tests: everything except the slow browser file(s) (a game's ui.test.js / play.test.js play whole games by taps in Chromium).
// Use this while working; `npm test` (everything) still gates every deploy.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const files = [];
for (const f of fs.readdirSync(path.join(root, 'tests'))) if (f.endsWith('.test.js')) files.push(path.join('tests', f));
for (const g of fs.readdirSync(path.join(root, 'games'))) {
  const dir = path.join(root, 'games', g, 'tests');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.test.js') && !/^(ui|play)[-.].*\.test\.js$/.test(f) && f !== 'ui.test.js' && f !== 'play.test.js') files.push(path.join('games', g, 'tests', f));
}
process.exit(spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' }).status);
