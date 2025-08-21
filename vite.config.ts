import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    // Copy Apryse WebViewer static assets to /webviewer (dev) and dist/webviewer (build)
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@pdftron/webviewer/public/*',
          dest: 'webviewer'
        }
      ]
    })
  ],
  assetsInclude: ['**/*.wasm'],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  build: {
    rollupOptions: {
      input: 'index.html'
    }
  }
});