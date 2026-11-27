// Roda depois do `vite build`: gera um HTML estático pra cada guia e ferramenta, com título,
// descrição e o texto da página — é isso que o Google e as prévias de link (WhatsApp, Instagram) leem.
// O React monta por cima normalmente quando a página abre. Também gera sitemap.xml e robots.txt.

import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
// O endereço público é o www: granaseria.com.br redireciona pra lá.
// SITE_URL na Vercel já apontou pra *.vercel.app (404). Esse valor é ignorado.
const CANONICO = 'https://www.granaseria.com.br';
function origemPublica() {
  const bruto = (process.env.SITE_URL || '').trim().replace(/\/$/, '');
  if (!bruto) return CANONICO;
  try {
    const host = new URL(bruto).hostname.toLowerCase();
    if (host === 'granaseria.com.br' || host === 'www.granaseria.com.br' || host.endsWith('.vercel.app')) return CANONICO;
    return bruto;
  } catch {
    return CANONICO;
  }
}
const SITE_URL = origemPublica();

// carrega os dados dos guias e das ferramentas direto do código do site (TypeScript)
async function load(entry) {
  const outfile = join(root, 'node_modules', '.prerender', entry.replace(/\W/g, '_') + '.mjs');
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', packages: 'external', outfile, logLevel: 'error' });
  const mod = await import(pathToFileURL(outfile).href);
  return mod;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(template, { path, title, description, body }) {
  const fullTitle = path === '/' ? `Grana Séria | ${title}` : `${title} | Grana Séria`;
  const url = `${SITE_URL}${path}`;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(fullTitle)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(description)}$2`);
  if (/<link rel="canonical"/.test(html)) html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${esc(url)}" />`);
  else html = html.replace('</head>', `  <link rel="canonical" href="${esc(url)}" />\n  </head>`);
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

const urls = ['/', '/guias', '/planos', '/faq', '/obrigado', '/politica-de-privacidade', '/termos-de-uso'];

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

await writeFile(
  join(dist, 'index.html'),
  page(template, {
    path: '/',
    title: 'Diagnóstico financeiro',
    description: 'O Grana Séria mostra pra onde o dinheiro vai, quanto você pode gastar hoje e o caminho pra sair do aperto. Sem precisar entender de finanças.',
    body: `<h1>O mês acabou e o dinheiro sumiu?</h1><p>O Grana Séria mostra pra onde ele vai, quanto você pode gastar hoje e o caminho pra sair do aperto. Sem precisar entender de finanças.</p><p>Sem senha de banco. Você testa no celular, anota o que entra e o que sai, e segue o próximo passo. Conteúdo educativo, não é consultoria financeira. CNPJ 69.557.683/0001-89.</p>`,
  })
);

await writePage(
  '/faq',
  page(template, {
    path: '/faq',
    title: 'Perguntas frequentes',
    description: 'Respostas curtas sobre dados, pagamento, login e como anotar um gasto no Grana Séria.',
    body: `<h1>Perguntas frequentes</h1><p>O app não pede senha de banco. O plano pago só libera quando o servidor confirma o pagamento. Você pode apagar os seus dados em Meus dados.</p>`,
  })
);

await writePage(
  '/obrigado',
  page(template, {
    path: '/obrigado',
    title: 'Pagamento recebido',
    description: 'O plano entra sozinho depois que o pagamento é confirmado. Entre com o mesmo WhatsApp ou e-mail da compra.',
    body: `<h1>Recebemos o seu pedido</h1><p>Se o pagamento foi aprovado, o plano entra em alguns minutos. Entre com o mesmo WhatsApp ou e-mail usado na compra.</p>`,
  })
);

await writePage(
  '/planos',
  page(template, {
    path: '/planos',
    title: 'Planos',
    description: 'Teste tudo por 7 dias. Depois, o básico segue grátis e o completo é mensal ou anual.',
    body: `<h1>Planos</h1><p>Teste tudo por 7 dias. Depois, o básico segue grátis e o completo é mensal ou anual.</p><ul><li>Grátis: diagnóstico, Início e Meu mês, com os dados no seu aparelho.</li><li>Mensal e anual: caminho pra sair das dívidas, Coach, WhatsApp, fatura do cartão, reserva, metas e investir.</li></ul><p>Conteúdo educativo, não é consultoria financeira.</p>`,
  })
);

await writePage(
  '/politica-de-privacidade',
  page(template, {
    path: '/politica-de-privacidade',
    title: 'Política de privacidade',
    description: 'O que a Grana Séria guarda, onde fica e como apagar: no aparelho, na conta e no WhatsApp.',
    body: `<h1>Política de privacidade</h1><p>A Grana Séria coleta as informações que você preenche no diagnóstico — renda, gastos, dívidas e reserva de emergência — apenas para calcular o seu resultado e o seu plano de ação. Não vendemos nem compartilhamos esses dados com terceiros para fins de publicidade.</p><p>Sem conta, tudo fica no seu navegador. Com login por e-mail, uma cópia fica na sua conta. No WhatsApp, o número serve para responder e lembrar. Para apagar, use Meus dados ou peça pelo suporte.</p>`,
  })
);

await writePage(
  '/termos-de-uso',
  page(template, {
    path: '/termos-de-uso',
    title: 'Termos de uso',
    description: 'A Grana Séria é educação financeira. Não é consultoria e não garante resultado.',
    body: `<h1>Termos de uso</h1><p>A Grana Séria é uma ferramenta de educação financeira. Ela gera um diagnóstico e um plano de ação a partir das informações que você informa.</p><p>Não é uma consultoria financeira registrada, não substitui um profissional certificado e não garante resultados. As projeções são estimativas. Você pode pedir reembolso integral em até 7 dias após a compra, pela plataforma de pagamento.</p>`,
  })
);

const today = new Date().toISOString().slice(0, 10);
await writeFile(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITE_URL}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`
);
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /conta\nDisallow: /painel\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
// rota de guia/ferramenta que não existe: a Vercel serve o 404.html, e o site mostra a página "não encontrada"
await writeFile(join(dist, '404.html'), template.replace(/<title>[^<]*<\/title>/, '<title>Página não encontrada | Grana Séria</title>'));
await rm(join(root, 'node_modules', '.prerender'), { recursive: true, force: true });

console.log(`prerender: ${urls.length} páginas no sitemap`);
