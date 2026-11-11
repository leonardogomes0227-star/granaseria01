import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownToLine, CalendarClock, CreditCard, FileText, Landmark, Receipt, Wallet, type LucideIcon } from 'lucide-react';
import { Folha } from './ui';
import { abrirAdicionar } from './AdicionarMov';

/* ---------- O botão [+] do meio da barra: as ações mais comuns, cada uma com o que ela faz por você ---------- */

export const EVENTO_MENU_ADICIONAR = 'gs-menu-adicionar';
export const abrirMenuAdicionar = () => window.dispatchEvent(new Event(EVENTO_MENU_ADICIONAR));

interface Acao {
  id: string;
  titulo: string;
  sub: string;
  icone: LucideIcon;
  /** Rota para abrir; sem rota, abre a folha de anotar. */
  rota?: string;
  anotar?: 'despesa' | 'receita';
}

export const ACOES_ADICIONAR: Acao[] = [
  { id: 'gasto', titulo: 'Anotar gasto', sub: 'Leva 5 segundos', icone: Wallet, anotar: 'despesa' },
  { id: 'entrada', titulo: 'Anotar entrada', sub: 'Salário ou dinheiro extra', icone: ArrowDownToLine, anotar: 'receita' },
  { id: 'conta', titulo: 'Cadastrar conta', sub: 'Eu aviso antes de vencer', icone: Receipt, rota: '/pagar?nova=1' },
  { id: 'divida', titulo: 'Cadastrar dívida', sub: 'Veja quando você fica livre', icone: Landmark, rota: '/plano/dividas?nova=1' },
  { id: 'fatura', titulo: 'Importar fatura', sub: 'PDF, foto ou texto do banco', icone: FileText, rota: '/plano/cartao#importar' },
  { id: 'atraso', titulo: 'Anotar conta atrasada', sub: 'Eu monto o plano para sair', icone: CalendarClock, rota: '/plano/atrasos?anotar=1' },
  { id: 'cartao', titulo: 'Compra no cartão', sub: 'Veja o que vem na fatura', icone: CreditCard, rota: '/plano/cartao' },
];

export function MenuAdicionar() {
  const [aberta, setAberta] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    const abrir = () => setAberta(true);
    window.addEventListener(EVENTO_MENU_ADICIONAR, abrir);
    return () => window.removeEventListener(EVENTO_MENU_ADICIONAR, abrir);
  }, []);
  const escolher = (a: Acao) => {
    setAberta(false);
    if (a.rota) nav(a.rota);
    else abrirAdicionar({ tipo: a.anotar });
  };
  return (
    <Folha aberta={aberta} onFechar={() => setAberta(false)} titulo="O que você quer fazer?">
      <div className="ad-grade">
        {ACOES_ADICIONAR.map((a, i) => (
          <button key={a.id} type="button" className={`ad-acao${i < 2 ? ' forte' : ''}`} onClick={() => escolher(a)}>
            <i aria-hidden="true"><a.icone size={22} strokeWidth={1.9} /></i>
            <span><b>{a.titulo}</b><small>{a.sub}</small></span>
          </button>
        ))}
      </div>
    </Folha>
  );
}
