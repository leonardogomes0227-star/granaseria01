// Troque CHECKOUT_URL pelo link de pagamento assim que criar o produto na Kiwify
// (ou Hotmart/Eduzz — qualquer uma funciona, é só trocar a URL aqui).
export const CHECKOUT_URL = 'https://pay.kiwify.com.br/SEU-LINK-AQUI';
export const PRICE_LABEL = 'R$ 30/mês';

// Planos pagos. Troque os preços aqui (e só aqui): a página /planos e a capa leem estas constantes.
export const PRECO_MENSAL = 30;
export const PRECO_ANUAL = 300; // 10 meses: dois meses de graça
// Um link de pagamento por plano (Cakto, Kiwify, Hotmart, Mercado Pago…). Mensal e anual já estão na Cakto. Enquanto estiver com "SEU-LINK-AQUI",
// os cartões mostram "Quero ser avisado" (WhatsApp) em vez de um botão de compra que levaria a uma página quebrada.
export const CHECKOUT_MENSAL = 'https://pay.cakto.com.br/dkukzez_1373243';
export const CHECKOUT_ANUAL = 'https://pay.cakto.com.br/32p9p4s';
export const checkoutPronto = (url: string) => !url.includes('SEU-LINK-AQUI');
// Enquanto o link de pagamento não for configurado, o plano aparece liberado —
// melhor do que mostrar um botão de compra que leva pra uma página quebrada.
export const CHECKOUT_READY = !CHECKOUT_URL.includes('SEU-LINK-AQUI');

// Preço de fundador: para quem já usava o Grana Séria antes do lançamento e ajudou o projeto. Troque os valores aqui se mudar na Cakto.
export const PRECO_FUNDADOR_MENSAL = 20;
export const PRECO_FUNDADOR_ANUAL = 200;
export const CHECKOUT_FUNDADOR_MENSAL = 'https://pay.cakto.com.br/hquo3d7';
export const CHECKOUT_FUNDADOR_ANUAL = 'https://pay.cakto.com.br/3dj7dj5';

const UNLOCK_KEY = 'selos-unlocked';

export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    localStorage.setItem(UNLOCK_KEY, 'true');
  } catch {
    // localStorage indisponível — segue sem persistir, não quebra a página
  }
}

// Marca que a pessoa completou o diagnóstico pelo menos uma vez — usado no painel de selos.
// Fica separado do progresso do wizard (que é limpo ao refazer) porque uma conquista não deve
// "sumir" só porque a pessoa decidiu refazer o diagnóstico.
const COMPLETED_KEY = 'selos-diagnosis-completed';

export function markDiagnosisCompleted(): void {
  try {
    localStorage.setItem(COMPLETED_KEY, 'true');
  } catch {
    // segue sem persistir
  }
}

export function hasDiagnosisCompleted(): boolean {
  try {
    return localStorage.getItem(COMPLETED_KEY) === 'true';
  } catch {
    return false;
  }
}

// Check-in mensal — versão localStorage. Quando a conta (Supabase) entrar, migra pra lá sem
// mudar a assinatura dessas duas funções, só a implementação por dentro.
import { CheckinEntry } from './types';

const CHECKINS_KEY = 'selos-checkins';

export function getCheckins(): CheckinEntry[] {
  try {
    const raw = localStorage.getItem(CHECKINS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CheckinEntry[];
  } catch {
    return [];
  }
}

export function addCheckin(entry: CheckinEntry): void {
  try {
    const current = getCheckins();
    localStorage.setItem(CHECKINS_KEY, JSON.stringify([...current, entry]));
  } catch {
    // segue sem persistir
  }
}
