const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'node_modules', '@pdftron', 'webviewer', 'public');
const dest = path.resolve(__dirname, '..', 'public', 'webviewer');

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.error('[WebViewer] Source not found:', srcDir);
    process.exit(1);
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const destPath = path.join(destDir, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[WebViewer] Copying assets...');
copyRecursive(src, dest);
console.log('[WebViewer] Assets copied to public/webviewer');