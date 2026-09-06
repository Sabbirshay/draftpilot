/**
 * Automated Zip Packaging Script for DraftPilot Chrome Extension
 * Packages contents of packages/extension/dist into packages/web/public/draftpilot-extension.zip
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extensionDir = path.resolve(__dirname, '..');
const distDir = path.join(extensionDir, 'dist');
const publicDir = path.resolve(extensionDir, '../web/public');
const targetZip = path.join(publicDir, 'draftpilot-extension.zip');

console.log('[build-zip] Packaging DraftPilot Chrome Extension...');

// 1. Validate dist/ directory exists
if (!fs.existsSync(distDir)) {
  console.error(`[build-zip] Error: Dist directory does not exist at ${distDir}. Run build first.`);
  process.exit(1);
}

// 2. Validate critical files exist in dist/
const requiredFiles = [
  'manifest.json',
  'web-handshake.js',
  'gmail-detector.js',
  'service-worker.js',
  'icons',
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(distDir, file)));
if (missingFiles.length > 0) {
  console.error(`[build-zip] Error: Missing critical files in dist/: ${missingFiles.join(', ')}`);
  process.exit(1);
}

// 3. Ensure target directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 4. Remove previous zip if present
if (fs.existsSync(targetZip)) {
  try {
    fs.unlinkSync(targetZip);
  } catch (err) {
    console.warn(`[build-zip] Note: Could not remove old zip: ${err.message}`);
  }
}

// 5. Create zip archive using system zip utility
try {
  // Zip contents of distDir into targetZip
  execSync(`zip -r -q "${targetZip}" .`, {
    cwd: distDir,
    stdio: 'inherit',
  });
} catch (err) {
  console.error(`[build-zip] Error executing zip command: ${err.message}`);
  process.exit(1);
}

// 6. Verify zip was created and check contents
if (!fs.existsSync(targetZip)) {
  console.error(`[build-zip] Error: Target zip was not created at ${targetZip}`);
  process.exit(1);
}

const stats = fs.statSync(targetZip);
if (stats.size === 0) {
  console.error(`[build-zip] Error: Target zip is empty (0 bytes)`);
  process.exit(1);
}

// List archive contents for verification log
const listOutput = execSync(`unzip -l "${targetZip}"`, { encoding: 'utf-8' });

console.log(`[build-zip] Successfully packaged extension archive:`);
console.log(`  Target: ${targetZip}`);
console.log(`  Size: ${stats.size} bytes`);
console.log(`  Archive contents:\n${listOutput}`);
