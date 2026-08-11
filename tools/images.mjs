// Regenerates every derivative in images/ from images/logo-source.jpg.
// Run it after dropping in a new logo:  npm run images && npm run build
//
// The source stays in the repo so this is repeatable; only the derivatives are
// referenced by the page. `npm run build` then stamps a content hash onto each
// URL, which matters here because the host caches images for four hours.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const SRC = REPO + 'images/logo-source.jpg';
const out = (name) => REPO + 'images/' + name;

const meta = await sharp(SRC).metadata();
console.log(`source  ${meta.width}x${meta.height}  ${meta.format}\n`);

const log = (name, info) =>
  console.log('  ' + name.padEnd(24) + `${info.width}x${info.height}`.padEnd(12) + `${info.size} bytes`);

/* ── the logo itself: displayed at 128px (mobile) / 176px (desktop) ──────── */
for (const w of [256, 352]) {
  log(`logo-${w}.webp`, await sharp(SRC)
    .resize(w, w, { fit: 'cover' })
    .webp({ quality: 78, effort: 6 })
    .toFile(out(`logo-${w}.webp`)));
}

/* ── icons ──────────────────────────────────────────────────────────────── */
log('favicon-32.png', await sharp(SRC)
  .resize(32, 32, { fit: 'cover' })
  .png({ compressionLevel: 9, palette: true })
  .toFile(out('favicon-32.png')));

log('apple-touch-icon.png', await sharp(SRC)
  .resize(180, 180, { fit: 'cover' })
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(out('apple-touch-icon.png')));

/* ── 1200x630 share card ────────────────────────────────────────────────────
   Brand frame in the site's neon green, with the logo dropped in on top; the
   logo brings its own palette so nothing is drawn around it. */
const W = 1200;
const H = 630;
const LOGO = 440;

const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="46%" r="58%">
      <stop offset="0%" stop-color="#00FF55" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="#00FF55" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#00FF55" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00FF55" stop-opacity="0"/>
      <stop offset="50%" stop-color="#00FF55" stop-opacity="1"/>
      <stop offset="100%" stop-color="#00FF55" stop-opacity="0"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#00FF55" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#030504"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="3" fill="url(#rule)"/>
  <rect x="0" y="${H - 3}" width="${W}" height="3" fill="url(#rule)"/>
</svg>`);

const circle = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO}" height="${LOGO}">` +
    `<circle cx="${LOGO / 2}" cy="${LOGO / 2}" r="${LOGO / 2}" fill="#fff"/></svg>`
);

const logo = await sharp(SRC)
  .resize(LOGO, LOGO, { fit: 'cover' })
  .composite([{ input: circle, blend: 'dest-in' }])
  .png()
  .toBuffer();

log('og-cover.jpg', await sharp(backdrop)
  .composite([{ input: logo, top: Math.round((H - LOGO) / 2), left: Math.round((W - LOGO) / 2) }])
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(out('og-cover.jpg')));
