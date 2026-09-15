// Troque CHECKOUT_URL pelo link de pagamento assim que criar o produto na Kiwify
// (ou Hotmart/Eduzz — qualquer uma funciona, é só trocar a URL aqui).
export const CHECKOUT_URL = 'https://pay.kiwify.com.br/SEU-LINK-AQUI';
export const PRICE_LABEL = 'R$ 27';

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
