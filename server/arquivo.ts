// Confere o começo do arquivo, não só o tipo que o navegador declarou.
// PDF, JPEG, PNG e WebP têm uma assinatura fixa nos primeiros bytes.

import type { MediaType } from './fatura.js';

function bytes(base64: string): Uint8Array | null {
  const pedaco = base64.replace(/\s/g, '').slice(0, 64);
  if (!pedaco || pedaco.length < 8) return null;
  try {
    const buf = Buffer.from(pedaco, 'base64');
    return buf.length >= 12 ? buf : null;
  } catch {
    return null;
  }
}

export function conteudoConfere(tipo: MediaType, base64: string): boolean {
  const b = bytes(base64);
  if (!b) return false;
  if (tipo === 'application/pdf') return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  if (tipo === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (tipo === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (tipo === 'image/webp') {
    const riff = String.fromCharCode(b[0], b[1], b[2], b[3]);
    const webp = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return riff === 'RIFF' && webp === 'WEBP';
  }
  return false;
}
