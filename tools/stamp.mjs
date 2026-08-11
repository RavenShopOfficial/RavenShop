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

// 2. now the stylesheet and script hashes
const cssHash = stamp(Buffer.from(css));
const jsHash = stamp(await read('assets/app.js'));

// 3. rewrite the references in index.html, keeping its CRLF line endings
const raw = await readText('index.html');
let html = raw.replace(/\r\n/g, '\n');

const versions = [
  ['assets/styles.css', cssHash],
  ['assets/app.js', jsHash],
  ['assets/fonts/Vazirmatn-subset.woff2', fontHash],
];

for (const [file, hash] of versions) {
  const pattern = new RegExp(
    '(' + file.replace(/[./]/g, (c) => '\\' + c) + ')(\\?v=[a-f0-9]+)?'
  );
  if (!pattern.test(html)) throw new Error(`no reference to ${file} in index.html`);
  html = html.replace(pattern, `$1?v=${hash}`);
  console.log(`  ${file.padEnd(38)} ?v=${hash}`);
}

await writeFile(REPO + 'index.html', html.replace(/\n/g, '\r\n'));
