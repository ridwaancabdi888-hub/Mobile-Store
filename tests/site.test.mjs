import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import stateNormalizer from '../state-normalizer.js';

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
  for (const file of ['state-normalizer.js', 'script.js', 'sw.js']) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
});

test('the HTML entry point references existing local assets', () => {
  for (const asset of ['manifest.webmanifest', 'icons/icon-192.png', 'style.css', 'state-normalizer.js', 'script.js']) {
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
    '/state-normalizer.js',
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

test('saved shopping state is repaired without discarding valid data', () => {
  const products = [{ id: 1, name: 'Phone' }, { id: 2, name: 'Tablet' }];
  const defaults = {
    cart: [], wishlist: [], orders: [], products, points: 100,
    theme: 'light', language: 'English', notifications: true,
    biometric: false, promo: '', usePoints: false,
    profile: { name: 'Demo', email: '', phone: '', address: '', city: 'Hargeisa' },
  };
  const saved = {
    cart: [
      { key: '1-a-black', id: '1', qty: 2.8, storage: '128GB', color: 'Black' },
      { key: '99-a-black', id: 99, qty: 1, storage: '128GB', color: 'Black' },
      { key: '2-a-black', id: 2, qty: 0, storage: '128GB', color: 'Black' },
    ],
    wishlist: [1, '1', 2, 99],
    points: 275,
    profile: { name: 'Ridwaan', city: 'Burco' },
    theme: 'dark',
  };

  const result = stateNormalizer.normalizeSavedStoreState(saved, defaults, products);

  assert.deepEqual(result.cart, [
    { key: '1-a-black', id: 1, qty: 2, storage: '128GB', color: 'Black' },
  ]);
  assert.deepEqual(result.wishlist, [1, 2]);
  assert.equal(result.points, 275);
  assert.deepEqual(result.profile, {
    name: 'Ridwaan', email: '', phone: '', address: '', city: 'Burco',
  });
  assert.equal(result.theme, 'dark');
});

test('invalid saved shopping state falls back to safe defaults', () => {
  const products = [{ id: 1, name: 'Phone' }];
  const defaults = {
    cart: [], wishlist: [], orders: [], products, points: 100,
    theme: 'light', language: 'English', notifications: true,
    biometric: false, promo: '', usePoints: false,
    profile: { name: 'Demo', email: '', phone: '', address: '', city: 'Hargeisa' },
  };
  const result = stateNormalizer.normalizeSavedStoreState({
    cart: {}, wishlist: 'broken', orders: null, products: [], points: -5,
    profile: 'broken', theme: 'sepia', language: 'Klingon',
    notifications: 'yes', biometric: 1, promo: 42, usePoints: 'true',
  }, defaults, products);

  assert.deepEqual(result.cart, []);
  assert.deepEqual(result.wishlist, []);
  assert.deepEqual(result.orders, []);
  assert.deepEqual(result.products, products);
  assert.equal(result.points, 100);
  assert.deepEqual(result.profile, defaults.profile);
  assert.equal(result.theme, 'light');
  assert.equal(result.language, 'English');
  assert.equal(result.notifications, true);
  assert.equal(result.biometric, false);
  assert.equal(result.promo, '');
  assert.equal(result.usePoints, false);
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
