// Copies CesiumJS static assets (workers, widgets, assets) into public/cesium so Vite serves them.
// Runs before dev/build; skips when the copy already matches the installed Cesium version.
import { cpSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'cesium', 'Build', 'Cesium');
const dst = join(root, 'public', 'cesium');
const version = JSON.parse(readFileSync(join(root, 'node_modules', 'cesium', 'package.json'), 'utf8')).version;
const stamp = join(dst, '.version');

if (existsSync(stamp) && readFileSync(stamp, 'utf8') === version) {
  console.log(`cesium assets ${version}: up to date`);
} else {
  rmSync(dst, { recursive: true, force: true });
  for (const dir of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) {
    cpSync(join(src, dir), join(dst, dir), { recursive: true });
  }
  writeFileSync(stamp, version);
  console.log(`cesium assets ${version}: copied to public/cesium`);
}
