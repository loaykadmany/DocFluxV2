const fs = require('fs');
const path = require('path');

// Copy PDF.js worker to public directory
const workerSrc = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const workerDest = path.join(__dirname, '../public/pdf.worker.min.mjs');

// Ensure public directory exists
const publicDir = path.dirname(workerDest);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy worker file
if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
  console.log('PDF.js worker copied to public directory');
} else {
  console.error('PDF.js worker source not found:', workerSrc);
}