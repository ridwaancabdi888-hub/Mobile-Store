import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import renderSafety from '../render-safety.js';
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
  for (const file of ['render-safety.js', 'state-normalizer.js', 'script.js', 'sw.js']) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
});

test('the HTML entry point references existing local assets', () => {
  for (const asset of ['manifest.webmanifest', 'icons/icon-192.png', 'style.css', 'render-safety.js', 'state-normalizer.js', 'script.js']) {
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
    '/render-safety.js',
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

test('catalog text is escaped before it is rendered as HTML', () => {
  assert.equal(
    renderSafety.escapeHtml(`<img src=x onerror="alert('x')"> & more`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; more',
  );
});

test('inline catalog values remain a single escaped JavaScript string', () => {
  const original = `128\" onclick=\"alert('x')\nGB`;
  const encoded = renderSafety.inlineString(original);
  assert.doesNotMatch(encoded, /[<>]/);
  assert.doesNotMatch(encoded, /"/);
  const decoded = encoded
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
  assert.equal(JSON.parse(decoded), original);
});

test('catalog images only use HTTP(S) or relative URLs', () => {
  assert.equal(renderSafety.safeImageUrl('https://example.com/phone.jpg?a=1&b=2'), 'https://example.com/phone.jpg?a=1&amp;b=2');
  assert.equal(renderSafety.safeImageUrl('/images/phone.jpg'), '/images/phone.jpg');
  assert.equal(renderSafety.safeImageUrl('javascript:alert(1)'), '');
  assert.equal(renderSafety.safeImageUrl('data:image/svg+xml,<svg onload=alert(1)>'), '');
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

test('saved products are normalized before the storefront uses them', () => {
  const seedProducts = [{ id: 1, name: 'Seed phone' }];
  const savedProducts = [
    {
      id: '22', name: '  Custom Phone  ', brand: ' Demo ', image: ' phone.jpg ',
      price: '499.50', oldPrice: '400', discount: 140, rating: 8, reviews: 4.9,
      storage: [' 128GB ', '128GB', '', null],
      colors: [['Graphite', '#444'], ['Unsafe', 'red; display:none'], ['Broken']],
      stock: false, description: '  Saved product  ', points: '75.9',
    },
    { id: 22, name: 'Duplicate id' },
    { id: 23, name: 'Missing required product fields' },
  ];

  const [product] = stateNormalizer.normalizeProducts(savedProducts, seedProducts);

  assert.deepEqual(product, {
    id: 22, name: 'Custom Phone', brand: 'Demo', image: 'phone.jpg',
    price: 499.5, oldPrice: 499.5, discount: 100, rating: 5, reviews: 4,
    storage: ['128GB'], colors: [['Graphite', '#444']], stock: false,
    description: 'Saved product', points: 75,
  });
});

test('an unusable saved catalog falls back to the seed catalog', () => {
  const seedProducts = [{ id: 1, name: 'Seed phone' }];
  const result = stateNormalizer.normalizeProducts([
    { id: 8, name: 'No variants', brand: 'Demo', price: 100 },
    null,
  ], seedProducts);

  assert.deepEqual(result, seedProducts);
  assert.notEqual(result, seedProducts);
});

test('cart recovery rejects non-finite quantities', () => {
  const products = [{ id: 1, name: 'Phone' }];
  const defaults = {
    cart: [], wishlist: [], orders: [], products, points: 100,
    theme: 'light', language: 'English', notifications: true,
    biometric: false, promo: '', usePoints: false,
    profile: { name: 'Demo', email: '', phone: '', address: '', city: 'Hargeisa' },
  };
  const result = stateNormalizer.normalizeSavedStoreState({
    cart: [
      { key: 'valid', id: 1, qty: '3', storage: '128GB', color: 'Black' },
      { key: 'infinite', id: 1, qty: Infinity, storage: '128GB', color: 'Black' },
    ],
  }, defaults, products);

  assert.deepEqual(result.cart, [
    { key: 'valid', id: 1, qty: 3, storage: '128GB', color: 'Black' },
  ]);
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
