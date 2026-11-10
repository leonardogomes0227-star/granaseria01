// Fatura em TEXTO (copiada do app do banco, extraída de um PDF ou lida de uma foto por OCR): acha as compras linha a linha.
// Heurística honesta: a pessoa sempre confere o que foi lido antes de usar (a tela mostra a lista e o total).
// Roda 100% no aparelho e sem API paga.

import { arred } from './datas';
import { lerParcela, lerValor, type CompraFatura, type LeituraFatura } from './faturaCsv';
import { sugerirCategoria } from './sugestoes';
import { CATEGORIAS_MOV } from './tipos';

const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const RE_VALOR_FIM = /(-?\s*R\$\s*-?\s*\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const RE_SO_VALOR = /^\s*-?\s*(?:R\$\s*)?-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*$/;
const RE_DATA = /^\s*(?:(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?|(\d{1,2})\s+(?:de\s+)?([A-Za-zçÇ]{3})[A-Za-zçÇ]*\.?(?:\s+(?:de\s+)?(\d{4}))?)\b\s*[-–·]?\s*/;
const NAO_E_COMPRA = /pagamento|fatura anterior|saldo (anterior|restante)|estorno|cr[eé]dito|total (da fatura|de compras)|limite|vencimento|encargos|juros e|iof de|subtotal/i;

function dataDe(m: RegExpExecArray, hoje: string): string | null {
  let dia: number, mes: number, ano: number | undefined;
  if (m[1]) { dia = Number(m[1]); mes = Number(m[2]); const a = m[3]; ano = a ? (a.length === 2 ? 2000 + Number(a) : Number(a)) : undefined; }
  else { dia = Number(m[4]); mes = MESES[semAcento(m[5])]; ano = m[6] ? Number(m[6]) : undefined; }
  if (!mes || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const ref = new Date(`${hoje}T12:00:00Z`);
  // sem ano: a compra é do ano atual, ou do ano passado se o mês ainda não chegou (fatura de dezembro lida em janeiro)
  const y = ano ?? (mes > ref.getUTCMonth() + 2 ? ref.getUTCFullYear() - 1 : ref.getUTCFullYear());
  const iso = `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** O OCR troca zero por "O" e um por "l"/"I" na data e no valor ("O3 NOV", "R$ 1O,50"). Conserta só esses casos, sem mexer na descrição. */
export function corrigirOcr(linha: string): string {
  const l = linha
    .replace(/^([OoQD])(\d)(?=[\s/])/, '0$2')
    .replace(/^([IlL|])(\d)(?=[\s/])/, '1$2')
    .replace(/^(\d)([OoQD])(?=[\s/])/, '$10')
    .replace(/^(\d)([IlL|])(?=[\s/])/, '$11');
  const m = RE_FIM_RUIDOSO.exec(l);
  if (!m) return l;
  const arrumado = m[0].replace(/(?<=[\d,.])[Oo](?=[\d,.]|\s*$)/g, '0').replace(/(?<=[\d,.])[Il|](?=[\d,.]|\s*$)/g, '1');
  return l.slice(0, m.index) + arrumado;
}
const RE_FIM_RUIDOSO = /(?:R\$\s*)?-?[\dOoIl|]{1,3}(?:\.[\dOoIl|]{3})*,[\dOoIl|]{2}\s*$/;

/** `hoje` só serve para descobrir o ano quando a linha não traz. `ocr`: o texto veio de uma foto, então conserta as trocas comuns. */
export function lerFaturaTexto(texto: string, hoje: string, opcoes: { ocr?: boolean } = {}): LeituraFatura {
  const linhas = texto.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).map((l) => (opcoes.ocr ? corrigirOcr(l) : l));
  const compras: CompraFatura[] = [];
  let ignoradas = 0;
  for (let i = 0; i < linhas.length; i++) {
    let linha = linhas[i];
    const md = RE_DATA.exec(linha);
    if (!md) continue; // linha sem data: cabeçalho, rodapé ou texto solto
    const data = dataDe(md, hoje);
    if (!data) { ignoradas++; continue; }
    let resto = linha.slice(md[0].length);
    // descrição numa linha e valor na seguinte (comum em captura de tela)
    if (!RE_VALOR_FIM.test(resto) && i + 1 < linhas.length && RE_SO_VALOR.test(linhas[i + 1])) { linha = `${resto} ${linhas[i + 1]}`; resto = linha; i++; }
    const mv = RE_VALOR_FIM.exec(resto);
    if (!mv) { ignoradas++; continue; }
    const bruto = mv[1];
    const valor = lerValor(bruto.replace(/\s/g, ''));
    const titulo = resto.slice(0, mv.index).replace(/R\$\s*$/, '').trim();
    if (!Number.isFinite(valor) || valor <= 0 || bruto.includes('-') || !titulo || NAO_E_COMPRA.test(titulo)) { ignoradas++; continue; }
    const { descricao, atual, total } = lerParcela(titulo);
    compras.push({ data, descricao: descricao.slice(0, 60), valor: arred(valor), parcelaAtual: atual, parcelasTotal: total, categoria: sugerirCategoria(descricao, CATEGORIAS_MOV) ?? 'Outros' });
  }
  if (compras.length === 0) return { compras, ignoradas, erro: 'Não consegui achar compras nesse texto. Confira se ele traz data, descrição e valor em cada linha.' };
  return { compras, ignoradas };
}
