// Dados de mercado reais pra aba Investir (Banco Central, CoinGecko, B3 com BRAPI_TOKEN). Só mesma origem.
// ?rapido=1 devolve só Bitcoin e dólar (cache de 60 s).

import { obterMercado, obterRapido } from '../server/mercado/fontes.js';

function mesmaOrigem(request: Request): boolean {
  const origem = request.headers.get('origin');
  if (origem) {
    try {
      return new URL(origem).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin' || site === 'none';
}

export async function GET(request: Request): Promise<Response> {
  if (!mesmaOrigem(request)) return Response.json({ error: 'Não consegui responder a partir desta página.' }, { status: 403 });
  const rapido = new URL(request.url).searchParams.get('rapido') === '1';
  try {
    if (rapido) {
      const r = await obterRapido();
      if (!r.btc && !r.usd) return Response.json({ error: 'Não consegui buscar os dados do mercado agora.' }, { status: 503 });
      return Response.json({ btc: r.btc, usd: r.usd }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const d = await obterMercado();
    if (!d) return Response.json({ error: 'Não consegui buscar os dados do mercado agora.' }, { status: 503 });
    return Response.json(d, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Não consegui buscar os dados do mercado agora.' }, { status: 503 });
  }
}
