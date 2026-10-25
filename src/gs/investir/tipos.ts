// O que /api/mercado devolve (espelha server/mercado/fontes.ts).
export interface Item {
  valor: number;
  fonte: string;
  atualizadoEm: string;
  desatualizado?: boolean;
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
  cripto?: { nome: string; simbolo: string; preco: number; var24h: number | null }[];
  b3?: { altas: { simbolo: string; preco: number; var: number }[]; baixas: { simbolo: string; preco: number; var: number }[] };
  avisos: string[];
}
