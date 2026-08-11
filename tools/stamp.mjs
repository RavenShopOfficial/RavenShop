// Stamps a short content hash onto the asset URLs in index.html (and onto the
// font URL inside the built CSS), so a deploy can never pair fresh HTML with a
// stale stylesheet or script. The host serves assets with max-age=14400, which
// without this means up to four hours of new markup driving old code.
//
// Run automatically by `npm run build`, after Tailwind writes assets/styles.css.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not pathname: the repo path contains a space
const REPO = fileURLToPath(new URL('..', import.meta.url));
const stamp = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

const read = (rel) => readFile(REPO + rel);
const readText = (rel) => readFile(REPO + rel, 'utf8');

// 1. font first: it is referenced from the stylesheet, so it has to be stamped
//    before the stylesheet's own hash is taken
const fontHash = stamp(await read('assets/fonts/Vazirmatn-subset.woff2'));

let css = await readText('assets/styles.css');
css = css.replace(
  /url\((fonts\/Vazirmatn-subset\.woff2)(\?v=[a-f0-9]+)?\)/,
  `url($1?v=${fontHash})`
);
await writeFile(REPO + 'assets/styles.css', css);

// 2. now hash everything index.html points at
const assets = [
  'assets/styles.css',
  'assets/app.js',
  'assets/fonts/Vazirmatn-subset.woff2',
  'images/logo-256.webp',
  'images/logo-352.webp',
  'images/favicon-32.png',
  'images/apple-touch-icon.png',
  'images/og-cover.jpg',
];

const hashes = new Map([['assets/fonts/Vazirmatn-subset.woff2', fontHash]]);
for (const rel of assets) {
  if (!hashes.has(rel)) hashes.set(rel, stamp(await read(rel)));
}

// 3. rewrite every reference in index.html, keeping its CRLF line endings
const raw = await readText('index.html');
let html = raw.replace(/\r\n/g, '\n');

for (const rel of assets) {
  const hash = hashes.get(rel);
  // global: logo-352 appears in both src and srcset, og-cover in two meta tags
  const pattern = new RegExp(
    '(' + rel.replace(/[./]/g, (c) => '\\' + c) + ')(\\?v=[a-f0-9]+)?',
    'g'
  );
  const before = html;
  html = html.replace(pattern, `$1?v=${hash}`);
  if (html === before && !before.includes(`${rel}?v=${hash}`)) {
    throw new Error(`no reference to ${rel} in index.html`);
  }
  const count = (html.match(pattern) || []).length;
  console.log(`  ${rel.padEnd(38)} ?v=${hash}  (${count} ref${count === 1 ? '' : 's'})`);
}

await writeFile(REPO + 'index.html', html.replace(/\n/g, '\r\n'));
