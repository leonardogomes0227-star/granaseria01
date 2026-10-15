// Roda depois do `vite build`: gera um HTML estático pra cada guia e ferramenta, com título,
// descrição e o texto da página — é isso que o Google e as prévias de link (WhatsApp, Instagram) leem.
// O React monta por cima normalmente quando a página abre. Também gera sitemap.xml e robots.txt.

import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://granaseria.com.br').replace(/\/$/, '');

// carrega os dados dos guias e das ferramentas direto do código do site (TypeScript)
async function load(entry) {
  const outfile = join(root, 'node_modules', '.prerender', entry.replace(/\W/g, '_') + '.mjs');
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', packages: 'external', outfile, logLevel: 'error' });
  const mod = await import(pathToFileURL(outfile).href);
  return mod;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(template, { path, title, description, body }) {
  const fullTitle = `${title} — Grana Séria`;
  const url = `${SITE_URL}${path}`;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace('</head>', `  <link rel="canonical" href="${esc(url)}" />\n  </head>`);
  html = html.replace(/<div id="root">.*?<\/div>/s, `<div id="root"><main class="page-wrap">${body}</main></div>`);
  return html;
}

async function writePage(path, html) {
  const dir = join(dist, path);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
}

const template = await readFile(join(dist, 'index.html'), 'utf8');
const { GUIDES } = await load('src/guides.ts');
const { TOOLS } = await load('src/tools.ts');

const urls = ['/', '/guias'];

await writePage(
  '/guias',
  page(template, {
    path: '/guias',
    title: 'Guias',
    description: 'Guias rápidos e diretos sobre dívidas, cartão de crédito, 13º salário, reserva de emergência e seus direitos com o banco.',
    body: `<h1>Guias pra resolver sua vida financeira</h1><ul>${GUIDES.map((g) => `<li><a href="/guias/${g.slug}">${esc(g.title)}</a> — ${esc(g.description)}</li>`).join('')}</ul>`,
  })
);

for (const g of GUIDES) {
  const path = `/guias/${g.slug}`;
  urls.push(path);
  const body =
    `<article><h1>${esc(g.title)}</h1>` +
    g.sections
      .map(
        (s) =>
          (s.h ? `<h2>${esc(s.h)}</h2>` : '') +
          (s.p ?? []).map((p) => `<p>${esc(p)}</p>`).join('') +
          (s.list ? `<ul>${s.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>` : '')
      )
      .join('') +
    `<p>${esc(g.cta.text)}</p></article>`;
  await writePage(path, page(template, { path, title: g.title, description: g.description, body }));
}

for (const t of TOOLS) {
  const path = `/ferramentas/${t.slug}`;
  urls.push(path);
  await writePage(path, page(template, { path, title: t.title, description: t.description, body: `<h1>${esc(t.title)}</h1><p>${esc(t.description)}</p>` }));
}

urls.push('/politica-de-privacidade', '/termos-de-uso');

const today = new Date().toISOString().slice(0, 10);
await writeFile(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITE_URL}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`
);
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /conta\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
// rota de guia/ferramenta que não existe: a Vercel serve o 404.html, e o site mostra a página "não encontrada"
await writeFile(join(dist, '404.html'), template.replace(/<title>[^<]*<\/title>/, '<title>Página não encontrada — Grana Séria</title>'));
await rm(join(root, 'node_modules', '.prerender'), { recursive: true, force: true });

console.log(`prerender: ${urls.length} páginas no sitemap`);
