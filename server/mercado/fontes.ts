// Dados de mercado reais, só no servidor: Banco Central (SGS), CoinGecko e, com BRAPI_TOKEN, B3.
// Cada bloco falha sozinho (allSettled). Cache em memória; se a fonte cair, devolve o último dado marcado "desatualizado".
// Nada é inventado: sem dado, o campo some e a tela mostra "Sem conexão com os dados de mercado agora".

import { baseCemDePrecos, baseCemDeTaxas, dataBCB, inflacaoPlausivel, jurosReal, mesesDaJanela, poupancaAnualPct, poupancaMensalPct, retornoFinal, taxaAnualPlausivel, taxaMensalPlausivel, ultimoDeCadaMes, type Ponto } from './calculos.js';

export interface Item {
  valor: number;
  fonte: string;
  atualizadoEm: string;
  desatualizado?: boolean;
}
export interface Cripto {
  nome: string;
  simbolo: string;
  preco: number;
  var24h: number | null;
}
export interface Mercado {
  gerado: string;
  selic?: Item;
  cdi?: Item;
  ipca12m?: Item;
  poupanca?: Item;
  dolar?: Item;
  bitcoin?: Item & { var24h: number | null };
  ibovespa?: Item & { var24h: number | null };
  jurosReal?: { valor: number; atualizadoEm: string };
  meses?: string[];
  series?: Record<string, number[]>;
  ranking?: { id: string; nome: string; retorno12m: number; risco: string; liquidez: string }[];
  cripto?: Cripto[];
  b3?: { altas: { simbolo: string; preco: number; var: number }[]; baixas: { simbolo: string; preco: number; var: number }[] };
  avisos: string[];
}

const UA = { 'User-Agent': 'GranaSeria/1.0 (+https://granaseria.com.br)', Accept: 'application/json' };

async function buscar<T>(url: string, ms = 8000): Promise<T> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: UA, signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

interface SGS {
  data: string;
  valor: string;
}
const sgs = async (codigo: number, ultimos: number): Promise<Ponto[]> => {
  const j = await buscar<SGS[]>(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/${ultimos}?formato=json`);
  return j.map((p) => ({ data: dataBCB(p.data), valor: Number(String(p.valor).replace(',', '.')) })).filter((p) => Number.isFinite(p.valor));
};

const agoraISO = () => new Date().toISOString();
const item = (valor: number, fonte: string): Item => ({ valor, fonte, atualizadoEm: agoraISO() });

/* ---------- cache ---------- */
let lento: { ts: number; dados: Mercado } | null = null;
let rapido: { ts: number; btc?: Item & { var24h: number | null }; usd?: Item } | null = null;
const TTL_LENTO = 15 * 60_000;
const TTL_RAPIDO = 60_000;

async function montarLento(): Promise<Mercado> {
  const avisos: string[] = [];
  const hoje = new Date();
  const mesAtual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;
  const janela = mesesDaJanela(mesAtual);
  const [selicS, cdiAnoS, ipca12S, cdiMesS, ipcaMesS, dolarS, btcHist, cripto, ibov, b3] = await Promise.allSettled([
    sgs(432, 400),
    sgs(4389, 1),
    sgs(13522, 1),
    sgs(4391, 14),
    sgs(433, 14),
    sgs(1, 400),
    buscar<{ prices: [number, number][] }>('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=brl&days=365&interval=daily', 10000),
    buscar<{ name: string; symbol: string; current_price: number; price_change_percentage_24h: number | null }[]>('https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&order=market_cap_desc&per_page=10&price_change_percentage=24h'),
    process.env.BRAPI_TOKEN ? buscar<{ results?: { regularMarketPrice?: number; regularMarketChangePercent?: number; historicalDataPrice?: { date: number; close: number }[] }[] }>(`https://brapi.dev/api/quote/%5EBVSP?range=1y&interval=1mo&token=${process.env.BRAPI_TOKEN}`) : Promise.reject(new Error('sem token')),
    process.env.BRAPI_TOKEN ? buscar<{ stocks?: { stock: string; close: number; change: number }[] }>(`https://brapi.dev/api/quote/list?sortBy=change&sortOrder=desc&limit=5&token=${process.env.BRAPI_TOKEN}`) : Promise.reject(new Error('sem token')),
  ]);

  const out: Mercado = { gerado: agoraISO(), avisos };
  const series: Record<string, number[]> = {};
  const ranking: NonNullable<Mercado['ranking']> = [];

  // Selic meta (% a.a.)
  let selic: number | null = null;
  if (selicS.status === 'fulfilled' && selicS.value.length) {
    const v = selicS.value[selicS.value.length - 1].valor;
    if (taxaAnualPlausivel(v)) {
      selic = v;
      out.selic = item(v, 'Banco Central (SGS 432)');
    } else avisos.push(`Série 432 (Selic) fora do esperado: ${v}. Descartada.`);
  }
  // CDI (% a.a.)
  if (cdiAnoS.status === 'fulfilled' && cdiAnoS.value.length) {
    const v = cdiAnoS.value[0].valor;
    if (taxaAnualPlausivel(v)) out.cdi = item(v, 'Banco Central (SGS 4389)');
    else avisos.push(`Série 4389 (CDI) fora do esperado: ${v}. Descartada.`);
  }
  // IPCA 12 meses (%)
  if (ipca12S.status === 'fulfilled' && ipca12S.value.length) {
    const v = ipca12S.value[0].valor;
    if (inflacaoPlausivel(v)) out.ipca12m = item(v, 'Banco Central (SGS 13522)');
    else avisos.push(`Série 13522 (IPCA 12m) fora do esperado: ${v}. Descartada.`);
  }
  // Poupança (calculada)
  if (selic !== null) out.poupanca = item(Math.round(poupancaAnualPct(selic) * 100) / 100, 'Calculada a partir da Selic (TR = 0)');
  if (out.cdi && out.ipca12m) out.jurosReal = { valor: jurosReal(out.cdi.valor, out.ipca12m.valor), atualizadoEm: agoraISO() };

  // Dólar
  let dolarMes: Map<string, number> | null = null;
  if (dolarS.status === 'fulfilled' && dolarS.value.length) {
    const ult = dolarS.value[dolarS.value.length - 1].valor;
    if (ult > 1 && ult < 20) {
      out.dolar = item(ult, 'Banco Central (SGS 1, venda)');
      dolarMes = ultimoDeCadaMes(dolarS.value);
    } else avisos.push(`Série 1 (dólar) fora do esperado: ${ult}. Descartada.`);
  }

  // séries mensais de taxa: CDI e IPCA (as 12 últimas)
  const taxas12 = (s: PromiseSettledResult<Ponto[]>): number[] | null => {
    if (s.status !== 'fulfilled') return null;
    const porMes = ultimoDeCadaMes(s.value);
    const t = janela.slice(1).map((m) => porMes.get(m));
    return t.every((x) => typeof x === 'number' && taxaMensalPlausivel(x)) ? (t as number[]) : null;
  };
  const cdi12 = taxas12(cdiMesS);
  if (cdi12) series.cdi = baseCemDeTaxas(cdi12);
  const ipca12 = taxas12(ipcaMesS);
  if (ipca12) series.ipca = baseCemDeTaxas(ipca12);
  // poupança por mês, com a Selic de cada mês
  if (selicS.status === 'fulfilled') {
    const selicPorMes = ultimoDeCadaMes(selicS.value);
    const t = janela.slice(1).map((m) => selicPorMes.get(m));
    if (t.every((x) => typeof x === 'number' && taxaAnualPlausivel(x as number))) series.poupanca = baseCemDeTaxas((t as number[]).map(poupancaMensalPct));
  }
  if (dolarMes) {
    const s = baseCemDePrecos(dolarMes, janela);
    if (s) series.dolar = s;
  }
  // Bitcoin: histórico e preço
  if (btcHist.status === 'fulfilled' && btcHist.value.prices?.length) {
    const pontos = btcHist.value.prices.map(([ms, v]) => ({ data: new Date(ms).toISOString().slice(0, 10), valor: v }));
    const s = baseCemDePrecos(ultimoDeCadaMes(pontos), janela);
    if (s) series.bitcoin = s;
  }
  // Ibovespa (com token)
  if (ibov.status === 'fulfilled') {
    const r = ibov.value.results?.[0];
    if (r?.regularMarketPrice) out.ibovespa = { ...item(r.regularMarketPrice, 'brapi.dev'), var24h: r.regularMarketChangePercent ?? null };
    const hist = r?.historicalDataPrice?.filter((h) => h.close > 0).map((h) => ({ data: new Date(h.date * 1000).toISOString().slice(0, 10), valor: h.close }));
    if (hist?.length) {
      const s = baseCemDePrecos(ultimoDeCadaMes(hist), janela);
      if (s) series.ibovespa = s;
    }
  }
  if (b3.status === 'fulfilled' && b3.value.stocks?.length) {
    const altas = b3.value.stocks.map((s) => ({ simbolo: s.stock, preco: s.close, var: s.change }));
    out.b3 = { altas, baixas: [] };
  }
  // cripto em alta
  if (cripto.status === 'fulfilled' && cripto.value.length) {
    out.cripto = cripto.value.map((c) => ({ nome: c.name, simbolo: c.symbol.toUpperCase(), preco: c.current_price, var24h: c.price_change_percentage_24h ?? null }));
  }

  if (Object.keys(series).length > 0) {
    out.meses = janela;
    out.series = series;
    const meta: Record<string, [string, string, string]> = {
      poupanca: ['Poupança', 'baixo', 'diária'],
      cdi: ['CDI (renda fixa)', 'baixo', 'diária'],
      ipca: ['Inflação (IPCA)', 'referência', '—'],
      dolar: ['Dólar', 'médio', 'diária'],
      bitcoin: ['Bitcoin', 'muito alto', 'diária'],
      ibovespa: ['Ibovespa', 'alto', 'D+2'],
    };
    for (const [id, [nome, risco, liquidez]] of Object.entries(meta)) {
      const r = series[id] ? retornoFinal(series[id]) : null;
      if (r !== null) ranking.push({ id, nome, retorno12m: r, risco, liquidez });
    }
    out.ranking = ranking.sort((a, b) => b.retorno12m - a.retorno12m);
  }
  return out;
}

async function montarRapido() {
  const [btc, usd] = await Promise.allSettled([
    buscar<{ bitcoin?: { brl?: number; brl_24h_change?: number } }>('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true'),
    sgs(1, 1),
  ]);
  const out: NonNullable<typeof rapido> = { ts: Date.now() };
  if (btc.status === 'fulfilled' && btc.value.bitcoin?.brl) out.btc = { ...item(btc.value.bitcoin.brl, 'CoinGecko'), var24h: btc.value.bitcoin.brl_24h_change ?? null };
  if (usd.status === 'fulfilled' && usd.value.length && usd.value[0].valor > 1 && usd.value[0].valor < 20) out.usd = item(usd.value[0].valor, 'Banco Central (SGS 1, venda)');
  return out;
}

/** Tudo (cache de 15 min), com o Bitcoin e o dólar em cache de 60 s. */
export async function obterMercado(): Promise<Mercado | null> {
  const agora = Date.now();
  if (!lento || agora - lento.ts > TTL_LENTO) {
    try {
      const d = await montarLento();
      const util = d.selic || d.cdi || d.series || d.cripto;
      if (util) lento = { ts: agora, dados: d };
      else if (lento) lento = { ...lento, dados: marcar(lento.dados) };
    } catch {
      if (lento) lento = { ...lento, dados: marcar(lento.dados) };
    }
  }
  if (!lento) return null;
  const r = await obterRapido();
  const d = { ...lento.dados };
  if (r.usd) d.dolar = { ...r.usd };
  if (r.btc) d.bitcoin = { ...r.btc };
  return d;
}

const marcar = (m: Mercado): Mercado => {
  const f = <T extends Item | undefined>(x: T): T => (x ? { ...x, desatualizado: true } : x);
  return { ...m, selic: f(m.selic), cdi: f(m.cdi), ipca12m: f(m.ipca12m), poupanca: f(m.poupanca), dolar: f(m.dolar), bitcoin: f(m.bitcoin), ibovespa: f(m.ibovespa) };
};

export async function obterRapido() {
  const agora = Date.now();
  if (!rapido || agora - rapido.ts > TTL_RAPIDO) {
    try {
      const novo = await montarRapido();
      rapido = novo.btc || novo.usd ? { ...novo, btc: novo.btc ?? rapido?.btc, usd: novo.usd ?? rapido?.usd } : rapido ? { ...rapido, btc: rapido.btc && { ...rapido.btc, desatualizado: true }, usd: rapido.usd && { ...rapido.usd, desatualizado: true } } : null;
    } catch {
      // mantém o último
    }
  }
  return rapido ?? { ts: 0 };
}
