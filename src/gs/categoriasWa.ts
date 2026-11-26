// As categorias do WhatsApp e as do site são nomes diferentes para as mesmas coisas.
// Aqui ficam os dois sentidos da tradução, para o que entra por um lado aparecer igual no outro.

const MERCADO = /mercado|supermercado|feira|hortifruti|a[cç]ougue|atacad|sacol[aã]o|mercadinho|quitanda|padaria|peixaria/i;

/** Nome do WhatsApp -> nome do site. Nomes que o site já usa passam como estão. */
export function categoriaDoSite(categoriaWa: string, descricao = ''): string {
  switch (categoriaWa) {
    case 'Alimentação': return MERCADO.test(descricao) ? 'Mercado' : 'Comida';
    case 'Moradia': return 'Casa';
    case 'Cuidados pessoais': return 'Compras';
    case 'Educação':
    case 'Pets':
    case 'Doações':
      return 'Outros';
    default: return categoriaWa;
  }
}

/** Nome do site -> nome do WhatsApp, para o resumo do bot somar tudo junto. */
export function categoriaDoWhatsApp(categoriaSite: string): string {
  switch (categoriaSite) {
    case 'Mercado':
    case 'Comida':
      return 'Alimentação';
    case 'Casa': return 'Moradia';
    default: return categoriaSite;
  }
}

/** É um nome que só existe no WhatsApp (e por isso precisa ser traduzido para o site)? */
export const ehCategoriaDoWhatsApp = (c: string) => ['Alimentação', 'Moradia', 'Cuidados pessoais', 'Educação', 'Pets', 'Doações'].includes(c);
