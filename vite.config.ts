import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The app is a plain web app. `npm run dev` serves it on localhost; `npm run build` writes the Chrome extension's app page into extension/app.
// TWO ENVIRONMENTS (see e2e/env.mjs): "work" is this default (dev server 5173, helper 7431, extension/app); tests set SWIFT_VITE_PORT, SWIFT_BUILD_OUT and VITE_HELPER_PORT
// so they never share a port, a build or a helper with the one in daily use.
export default defineConfig({ root: 'app', base: './', plugins: [react()], server: { port: Number(process.env.SWIFT_VITE_PORT) || 5173, strictPort: true }, build: { outDir: process.env.SWIFT_BUILD_OUT || '../extension/app', emptyOutDir: true, target: 'es2022' }, test: { include: ['src/**/*.test.ts'] } });
