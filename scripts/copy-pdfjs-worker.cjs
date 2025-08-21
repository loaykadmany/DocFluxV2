const fs = require('fs');
const path = require('path');

const srcWorker = path.resolve(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destWorker = path.resolve(__dirname, '..', 'public', 'pdf.worker.min.mjs');

console.log('[PDF.js copy] Copying PDF.js worker...');

if (!fs.existsSync(srcWorker)) {
  console.error('[PDF.js copy] Source worker not found:', srcWorker);
  process.exit(1);
}

// Ensure public directory exists
const publicDir = path.dirname(destWorker);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy the worker file
fs.copyFileSync(srcWorker, destWorker);
console.log('[PDF.js copy] PDF.js worker copied to public/pdf.worker.min.mjs');