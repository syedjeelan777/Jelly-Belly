import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// STICKYVERSE build config.
// Works out of the box on Vercel / Netlify (base: '/'). For GitHub Pages,
// set VITE_BASE, e.g. `VITE_BASE=/stickyverse/ npm run build`.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Accept preview/proxy hostnames (e.g. *.e2b.app) and LAN IPs.
    allowedHosts: true,
  },
});
