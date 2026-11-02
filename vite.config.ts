import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The app is a plain web app. `npm run dev` serves it on localhost; `npm run build` writes the Chrome extension's app page into extension/app.
export default defineConfig({ root: 'app', base: './', plugins: [react()], server: { port: 5173, strictPort: true }, build: { outDir: '../extension/app', emptyOutDir: true, target: 'es2022' }, test: { include: ['src/**/*.test.ts'] } });
