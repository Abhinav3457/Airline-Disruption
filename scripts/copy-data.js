/**
 * Copies seed JSON data from src/data to dist/data after `tsc` runs.
 * Plain CommonJS Node script (no dependencies) so it works in any build env.
 */
const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.resolve(__dirname, '..', 'src', 'data');
const outDir = path.resolve(__dirname, '..', 'dist', 'data');

fs.mkdirSync(outDir, { recursive: true });

const files = ['customers.json', 'bookings.json', 'policies.json', 'action-logs.json'];

for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
  console.log(`  copied src/data/${file} -> dist/data/${file}`);
}
