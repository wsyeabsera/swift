// The TEST environment, shared by every e2e script. Work and test never share anything:
//   work (what you use):  helper 127.0.0.1:7431 (~/.swift-canvas), dev server :5173, extension/app
//   test (this file):     helper 127.0.0.1:7441 (a temp data dir per run), dev server :5273, extension built into .e2e/extension
// Tests start and stop ONLY processes on the test ports; they never pkill by name, never touch 7431/5173 and never rebuild extension/app.
import net from 'node:net'; import path from 'node:path'; import fs from 'node:fs'; import os from 'node:os'; import { spawn, execFileSync } from 'node:child_process';
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const TEST = { helperPort: 7441, vitePort: 5273, extDir: path.join(ROOT, '.e2e', 'extension') };
export const WORK = { helperPort: 7431, vitePort: 5173 };
export const TEST_URL = `http://localhost:${TEST.vitePort}/`;
/** Environment for the test dev server: its own port, and the app told the test helper's port. */
export const viteEnv = { ...process.env, SWIFT_VITE_PORT: String(TEST.vitePort), VITE_HELPER_PORT: String(TEST.helperPort) };
/** Environment for a test helper: its own port; callers add SWIFT_DATA_DIR and the rest. */
export const helperEnv = { ...process.env, SWIFT_HELPER_PORT: String(TEST.helperPort), SWIFT_DEV_ORIGIN: `http://localhost:${TEST.vitePort}` };
export const inUse = (port) => new Promise((res) => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); });
/** Test ports must be free at the start (a stale TEST process is ours to stop, the work helper is not): exits with a hint otherwise. */
export async function requireFreeTestPorts() { for (const port of [TEST.helperPort, TEST.vitePort]) if (await inUse(port)) { console.error(`test port ${port} is in use (a stale test process?): run \`npm run e2e:clean\``); process.exit(2); } }
/** Stop whatever listens on the TEST ports (never the work ports). */
export function cleanTestPorts() { for (const port of [TEST.helperPort, TEST.vitePort, 8910, 8911, 8912, 8913]) { try { const pids = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).split(/\s+/).filter(Boolean); for (const pid of pids) { try { process.kill(Number(pid)); } catch {} } } catch { /* nothing listens */ } } }
/** The Vite dev server for tests (own port, test helper port baked in). */
export const startVite = () => spawn('node', ['node_modules/vite/bin/vite.js', '--config', 'vite.config.ts'], { cwd: ROOT, env: viteEnv, stdio: 'ignore' });
