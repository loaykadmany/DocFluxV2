import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    fs: {
      allow: ['..']
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  optimizeDeps: {
    include: ['react-pdf', 'pdfjs-dist']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'pdfjs': ['react-pdf', 'pdfjs-dist']
        }
      }
    },
    assetsDir: 'assets',
    assetsInlineLimit: 0
  },
  worker: {
    format: 'es'
  },
  define: {
    global: 'globalThis'
  }
});