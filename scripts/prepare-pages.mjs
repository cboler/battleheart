import { existsSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Locate the browser build directory dynamically to ensure complete repo-name independence
function findBrowserDir(baseDir) {
  const primaryCandidate = resolve(baseDir, 'dist/browser');
  if (existsSync(join(primaryCandidate, 'index.html'))) {
    return primaryCandidate;
  }

  const distDir = resolve(baseDir, 'dist');
  if (existsSync(distDir)) {
    const entries = readdirSync(distDir);
    for (const entry of entries) {
      const candidate = join(distDir, entry, 'browser');
      if (
        existsSync(candidate) &&
        statSync(candidate).isDirectory() &&
        existsSync(join(candidate, 'index.html'))
      ) {
        return candidate;
      }
    }
  }

  return null;
}

const rootDir = process.cwd();
const browserDir = findBrowserDir(rootDir);

if (!browserDir) {
  console.error('Error: Could not locate browser build output directory containing index.html.');
  process.exit(1);
}

const indexPath = join(browserDir, 'index.html');
const notFoundPath = join(browserDir, '404.html');

copyFileSync(indexPath, notFoundPath);
console.log(`✓ Generated SPA fallback: copied index.html -> ${notFoundPath}`);

const manifestPath = join(browserDir, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
  console.log('✓ Found Web App Manifest: manifest.webmanifest');
} else {
  console.warn('⚠ Warning: manifest.webmanifest not found in browser directory');
}

const swPath = join(browserDir, 'ngsw.json');
if (existsSync(swPath)) {
  console.log('✓ Found Angular Service Worker configuration: ngsw.json');
} else {
  console.warn(
    '⚠ Warning: ngsw.json not found in browser directory (production build may not have been run with service worker)',
  );
}
