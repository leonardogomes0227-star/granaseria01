// Lê a fatura de um arquivo no próprio aparelho, sem enviar nada a nenhum servidor de IA e sem custo:
// CSV/texto direto · PDF com o texto extraído pelo pdf.js · foto ou print lido por OCR (Tesseract, em português).
// As bibliotecas pesadas só são baixadas quando a pessoa escolhe PDF ou imagem.

import { lerFaturaCsv, type LeituraFatura } from './faturaCsv';
import { lerFaturaTexto } from './faturaTexto';

const LIMITE_MB = 15;

/** CSV ou texto colado: tenta o formato de planilha e, se não for, lê linha a linha. */
export function lerTextoDaFatura(texto: string, hoje: string): LeituraFatura {
  const csv = lerFaturaCsv(texto);
  if (!csv.erro) return csv;
  const txt = lerFaturaTexto(texto, hoje);
  return txt.erro ? { ...txt, erro: csv.erro.startsWith('Não reconheci as colunas') ? txt.erro : csv.erro } : txt;
}

async function textoDoPdf(arq: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arq.arrayBuffer()) }).promise;
  const linhas: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 30); n++) {
    const conteudo = await (await doc.getPage(n)).getTextContent();
    const itens = conteudo.items.filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && 'transform' in i);
    const porY = new Map<number, { x: number; s: string }[]>();
    for (const i of itens) {
      const y = Math.round(i.transform[5] / 3); // itens quase na mesma altura são a mesma linha
      porY.set(y, [...(porY.get(y) ?? []), { x: i.transform[4], s: i.str }]);
    }
    for (const y of [...porY.keys()].sort((a, b) => b - a)) linhas.push((porY.get(y) ?? []).sort((a, b) => a.x - b.x).map((p) => p.s).join(' '));
  }
  return linhas.join('\n');
}

async function textoDaImagem(arq: File, progresso?: (t: string) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const w = await createWorker('por', 1, { logger: (m: { status: string; progress: number }) => progresso?.(`${m.status === 'recognizing text' ? 'Lendo a imagem' : 'Preparando a leitura'}… ${Math.round(m.progress * 100)}%`) });
  try {
    const { data } = await w.recognize(arq);
    return data.text;
  } finally {
    await w.terminate();
  }
}

/** Qualquer arquivo de fatura → compras para conferir. Nunca lança: erro vira mensagem. */
export async function lerArquivoFatura(arq: File, hoje: string, progresso?: (t: string) => void): Promise<LeituraFatura> {
  if (arq.size > LIMITE_MB * 1024 * 1024) return { compras: [], ignoradas: 0, erro: `O arquivo passa de ${LIMITE_MB} MB. Escolha um menor.` };
  const nome = arq.name.toLowerCase();
  try {
    if (arq.type === 'application/pdf' || nome.endsWith('.pdf')) {
      progresso?.('Lendo o PDF…');
      const r = lerFaturaTexto(await textoDoPdf(arq), hoje);
      return r.erro ? { ...r, erro: `${r.erro} Se o PDF for uma imagem escaneada, tente enviar a foto ou o print.` } : r;
    }
    if (arq.type.startsWith('image/')) {
      progresso?.('Preparando a leitura da imagem… (na primeira vez baixa o leitor de português)');
      const r = lerFaturaTexto(await textoDaImagem(arq, progresso), hoje, { ocr: true });
      return r.erro ? { ...r, erro: `${r.erro} Tente um print mais nítido, só com a lista de compras.` } : r;
    }
    return lerTextoDaFatura(await arq.text(), hoje);
  } catch {
    return { compras: [], ignoradas: 0, erro: 'Não consegui ler esse arquivo. Tente outro formato (CSV, PDF ou imagem) ou cole o texto da fatura.' };
  }
}
