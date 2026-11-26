// O que dá para segurar ("gasto com besteira", dito sem julgar): a mesma regra no site e no WhatsApp.
// Lazer, compras e assinaturas, mais o que pesa sem dar nada em troca (delivery, bar, jogo, aposta, cigarro…).

const CATEGORIAS = new Set(['Lazer', 'Compras', 'Assinaturas']);
const PALAVRAS = /\b(ifood|i food|rappi|delivery|netflix|spotify|prime|disney|hbo|globoplay|youtube premium|assinatura|cerveja|cervejada|bar|balada|boteco|jogo|jogos|game|steam|playstation|xbox|bet|bets|aposta|cigarro|vape|tabaco|sorvete|doce|salgadinho|besteira|shein|shopee|aliexpress)\b/i;

export const ehGastoDeCorte = (r: { category: string; description: string }) => CATEGORIAS.has(r.category) || PALAVRAS.test(r.description);
