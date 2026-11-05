import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync('index.html', 'utf8');
const serviceWorker = readFileSync('sw.js', 'utf8');
const readability = readFileSync('readability.css', 'utf8');

test('readability.css loads after style.css so its sizes win', () => {
  const base = html.indexOf('href="style.css"');
  const floor = html.indexOf('href="readability.css"');
  assert.ok(base !== -1, 'index.html must link style.css');
  assert.ok(floor > base, 'readability.css must be linked after style.css');
});

test('the service worker caches readability.css for offline use', () => {
  assert.match(serviceWorker, /'\/readability\.css'/);
});

test('the readability floor never sets text below 10px', () => {
  const sizes = [...readability.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(match => Number(match[1]));
  assert.ok(sizes.length > 0, 'readability.css should set font sizes');
  for (const size of sizes) assert.ok(size >= 10, `font-size ${size}px is below the 10px floor`);
});

test('touch devices get 16px form fields so iOS does not zoom on focus', () => {
  assert.match(readability, /@media \(pointer:coarse\)\{[^}]*font-size:16px/);
});
