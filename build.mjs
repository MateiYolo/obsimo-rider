// Génère le site statique (dist/) à partir de content/*.md, puis un PDF par langue.
// Usage : npm run build        (HTML + PDF)
//         npm run build -- --no-pdf   (HTML seulement, plus rapide en local)
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { marked } from 'marked';

const DIST = 'dist';
const withPdf = !process.argv.includes('--no-pdf');

const langs = readdirSync('content')
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''))
  .sort((a, b) => (a === 'fr' ? -1 : b === 'fr' ? 1 : a.localeCompare(b)));

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST);
cpSync('assets', `${DIST}/assets`, { recursive: true });
// three.js embarqué (pas de dépendance à un CDN) : seulement les fichiers utilisés par stage3d.js
for (const f of ['build/three.module.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/renderers/CSS2DRenderer.js']) {
  cpSync(`node_modules/three/${f}`, `${DIST}/vendor/three/${f}`);
}

function parse(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file} : il manque l'en-tête --- ... ---`);
  const meta = Object.fromEntries(
    m[1].split('\n').filter(Boolean).map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  return { meta, body: m[2] };
}

// Date du dernier commit qui a touché le fichier. Vercel clone sans tout l'historique :
// si le fichier n'y apparaît pas, on prend le dernier commit tout court, sinon aujourd'hui.
function lastUpdated(file) {
  for (const cmd of [`git log -1 --format=%cI -- "${file}"`, 'git log -1 --format=%cI']) {
    try {
      const iso = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (iso) return new Date(iso);
    } catch {}
  }
  return new Date();
}

// Sur Vercel, le Chrome de Playwright ne peut pas installer ses dépendances système :
// on utilise @sparticuz/chromium, un Chromium autonome fait pour ces environnements.
async function launchBrowser() {
  const { chromium } = await import('playwright-core');
  if (process.env.VERCEL) {
    const { default: sparticuz } = await import('@sparticuz/chromium');
    return chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args });
  }
  return chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const md = (s) => marked.parse(s).replace(/<img src="(?!https?:)/g, '<img src="../assets/'); // pas de lazy-loading : sinon les images risquent de manquer dans le PDF

// L'image stage-plot.jpg est remplacée à l'écran par le plan 3D (assets/stage3d.js).
// L'image reste dans la page : elle sert pour le PDF et si le navigateur n'a pas WebGL.
const withStage3d = (html, lang) =>
  html.replace(
    /<p>(<img[^>]*src="\.\.\/assets\/stage-plot\.jpg"[^>]*>)<\/p>/,
    (_, img) => `<figure class="stage"><div class="stage3d" data-lang="${lang}" hidden></div>${img.replace('<img', '<img class="stage-fallback"')}</figure>`,
  );

function page({ lang, meta, body, date }) {
  const [rider, tech = ''] = body.split('<!-- tech -->');
  const dateStr = date.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const switcher = langs
    .map((l) => (l === lang ? `<strong>${l.toUpperCase()}</strong>` : `<a href="../${l}/" hreflang="${l}">${l.toUpperCase()}</a>`))
    .join('');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>OBSIMO — ${esc(meta.title)}</title>
<link rel="icon" href="../assets/favicon.png">
<link rel="stylesheet" href="../assets/style.css">
</head>
<body>
<nav class="bar">
  <div class="langs">${switcher}</div>
  <a class="dl" href="../obsimo-rider-${lang}.pdf" download>↓ ${esc(meta.download)}</a>
</nav>
<main>
  <header class="cover">
    <p class="kicker">${esc(meta.title)}</p>
    <h1><img src="../assets/logo.png" alt="OBSIMO"></h1>
    <p class="updated">${esc(meta.updated)} ${dateStr}</p>
  </header>
  <section class="rider">${md(rider)}</section>
  ${tech.trim() ? `<section class="tech"><h1 class="tech-title">${esc(meta.techTitle)}</h1>${withStage3d(md(tech), lang)}</section>` : ''}
</main>
<script type="importmap">
{ "imports": {
  "three": "../vendor/three/build/three.module.js",
  "three/addons/": "../vendor/three/examples/jsm/"
} }
</script>
<script type="module" src="../assets/stage3d.js"></script>
</body>
</html>`;
}

for (const lang of langs) {
  const file = `content/${lang}.md`;
  const { meta, body } = parse(file);
  mkdirSync(`${DIST}/${lang}`);
  writeFileSync(`${DIST}/${lang}/index.html`, page({ lang, meta, body, date: lastUpdated(file) }));
}

// Page d'accueil : redirige vers la langue du navigateur (FR par défaut).
writeFileSync(`${DIST}/index.html`, `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>OBSIMO — Rider</title>
<script>
  var langs = ${JSON.stringify(langs)};
  var nav = (navigator.languages || [navigator.language || 'fr']).map(function (l) { return l.slice(0, 2).toLowerCase(); });
  var pick = nav.find(function (l) { return langs.indexOf(l) !== -1; }) || '${langs[0]}';
  location.replace(pick + '/' + location.search);
</script></head>
<body>${langs.map((l) => `<a href="${l}/">${l.toUpperCase()}</a>`).join(' · ')}</body></html>`);

if (withPdf) {
  const { createServer } = await import('node:http');
  const { extname, join } = await import('node:path');
  const types = { '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const server = createServer((req, res) => {
    let p = join(DIST, decodeURIComponent(req.url.split('?')[0]));
    if (p.endsWith('/')) p += 'index.html';
    try {
      res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
      res.end(readFileSync(p));
    } catch {
      res.writeHead(404).end();
    }
  }).listen(0);
  const port = server.address().port;
  const browser = await launchBrowser();
  const pg = await browser.newPage();
  for (const lang of langs) {
    await pg.goto(`http://localhost:${port}/${lang}/`, { waitUntil: 'networkidle' });
    await pg.pdf({
      path: `${DIST}/obsimo-rider-${lang}.pdf`,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
    console.log(`PDF ${lang} ✓`);
  }
  await browser.close();
  server.close();
}

console.log(`Build OK → ${DIST}/ (${langs.join(', ')})`);
