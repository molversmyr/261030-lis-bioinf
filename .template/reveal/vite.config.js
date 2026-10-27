import { defineConfig } from 'vite';

// base './' keeps the build relocatable (GitHub Pages project path, file share, USB stick).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
});
