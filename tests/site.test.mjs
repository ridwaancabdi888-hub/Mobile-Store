import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync('index.html', 'utf8');
const script = readFileSync('script.js', 'utf8');
const serviceWorker = readFileSync('sw.js', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));

function pngDimensions(path) {
  const data = readFileSync(path);
  assert.equal(data.subarray(1, 4).toString(), 'PNG', `${path} must be a PNG file`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

test('JavaScript sources pass Node syntax checks', () => {
  for (const file of ['script.js', 'sw.js']) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
});

test('the HTML entry point references existing local assets', () => {
  for (const asset of ['manifest.webmanifest', 'icons/icon-192.png', 'style.css', 'script.js']) {
    assert.ok(html.includes(asset), `index.html must reference ${asset}`);
    assert.ok(existsSync(asset), `${asset} must exist`);
  }
});

test('the application roots required by script.js remain in the HTML', () => {
  for (const id of ['appView', 'bottomNav', 'modalRoot', 'pwaInstallFab', 'toastRegion', 'clock']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
});

test('manifest icons exist at their declared dimensions', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    assert.ok(existsSync(icon.src), `${icon.src} must exist`);
    const expected = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngDimensions(icon.src), expected, `${icon.src} dimensions must match the manifest`);
  }
});

test('the service-worker app shell contains every core local asset', () => {
  for (const asset of [
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
  ]) {
    assert.ok(serviceWorker.includes(`'${asset}'`), `app shell must cache ${asset}`);
    assert.ok(existsSync(asset.slice(1)), `${asset} must resolve to a repository file`);
  }
});

test('offline handling is limited to same-origin GET requests', () => {
  assert.match(serviceWorker, /event\.request\.method !== 'GET'/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /event\.request\.mode === 'navigate'/);
  assert.match(serviceWorker, /catch\(\(\) => caches\.match\('\/index\.html'\)\)/);
});

test('bottom sheets expose dialog semantics and an accessible name', () => {
  assert.ok(script.includes('role="dialog" aria-modal="true" tabindex="-1"'));
  assert.ok(script.includes("sheet.setAttribute('aria-labelledby',title.id)"));
  assert.ok(script.includes("sheet.setAttribute('aria-label','Dialog')"));
});

test('bottom sheets trap focus, isolate the page, and restore the trigger', () => {
  assert.match(script, /event\.key==='Escape'/);
  assert.match(script, /event\.key!=='Tab'/);
  assert.match(script, /event\.shiftKey&&document\.activeElement===first/);
  assert.match(script, /document\.activeElement===last/);
  assert.ok(script.includes("setAttribute('inert','')"));
  assert.ok(script.includes("removeAttribute('inert')"));
  assert.ok(script.includes('if(trigger?.isConnected)trigger.focus()'));
});
