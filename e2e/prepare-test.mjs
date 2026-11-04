// Builds the extension for TESTS into .e2e/extension (a copy of extension/ with its own app build that talks to the test helper), leaving extension/ (the one loaded in your browser) untouched.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { ROOT, TEST } from './env.mjs';
fs.rmSync(path.dirname(TEST.extDir), { recursive: true, force: true }); fs.mkdirSync(TEST.extDir, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'extension'))) { if (f === 'app') continue; fs.cpSync(path.join(ROOT, 'extension', f), path.join(TEST.extDir, f), { recursive: true }); }
execFileSync('node', ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.config.ts'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, SWIFT_BUILD_OUT: path.join(TEST.extDir, 'app'), VITE_HELPER_PORT: String(TEST.helperPort) } });
fs.copyFileSync(path.join(ROOT, 'app/src/canvas/bridge-frame.js'), path.join(TEST.extDir, 'frame.js')); console.log(`test extension built in ${path.relative(ROOT, TEST.extDir)} (helper port ${TEST.helperPort})`);
