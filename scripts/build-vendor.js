const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'vendor');
fs.mkdirSync(vendorDir, { recursive: true });

const bundles = [
  {
    entry: 'node_modules/webjsx/dist/index.js',
    out: 'vendor/webjsx.js',
    label: 'webjsx',
  },
  {
    entry: 'node_modules/xstate/dist/xstate.esm.js',
    out: 'vendor/xstate.js',
    label: 'xstate',
  },
];

for (const b of bundles) {
  process.stdout.write(`Bundling ${b.label}... `);
  execSync(
    `npx esbuild ${b.entry} --bundle --format=esm --outfile=${b.out} --platform=browser`,
    { cwd: root, stdio: 'pipe' }
  );
  const size = fs.statSync(path.join(root, b.out)).size;
  console.log(`done (${(size / 1024).toFixed(1)}kb)`);
}

console.log('Vendor build complete.');
