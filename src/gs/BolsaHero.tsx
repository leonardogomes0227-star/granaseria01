// O topo do Início, como na referência: carteira de couro em 3D com os cartões das contas aparecendo por trás,
// "Saldo total" grande na frente e os botões. Tudo vem dos números que o app já calcula.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Eye, EyeOff, House, Plus, Share2 } from 'lucide-react';
import { brl0, mesDe, nomeMes } from './datas';
import { useContagem } from './base';
import { painelVidro } from './painelVidro';
import { definirOculto, mascarar, useOculto } from './privacidade';
import { patrimonioGuardado, reservaMeta, sequenciaDeDias } from './selectores';
import { saudeFinanceira } from './saude';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { abrirAdicionar } from './AdicionarMov';
import { compartilharMes } from './cartaoDoMes';
import { objetivosDaPessoa } from './objetivos';
import { tocar } from './sons';
import { toast } from '../components/ui/Toast';
import type { CartaoBolsa, CenaBolsa } from './bolsa3d';

const FAIXA = 54; // quanto de cada cartão aparece por trás

function Dinheiro({ valor, oculto }: { valor: number; oculto: boolean }) {
  const n = useContagem(valor, 900);
  return <>{oculto ? mascarar(brl0(valor), true) : brl0(n)}</>;
}

export function BolsaHero() {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const mes = mesDe(hoje);
  const p = useMemo(() => painelVidro(e, hoje), [e, hoje]);
  const saldo = p.kpis.find((k) => k.id === 'saldo')?.valor ?? null;
  const receitas = p.kpis.find((k) => k.id === 'receitas')?.valor ?? null;
  const despesas = p.kpis.find((k) => k.id === 'despesas')?.valor ?? null;
  const guardado = Math.max(0, patrimonioGuardado(e));
  const meta = reservaMeta(e, mes);
  const pct = meta > 0 ? Math.min(1, guardado / meta) : 0;
  const [aberta, setAberta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [semWebgl, setSemWebgl] = useState(false);
  const [tresD, setTresD] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const frente = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaBolsa | null>(null);

  // cartões que aparecem por trás: os objetivos da pessoa (reserva, meta, dívida ou liberdade financeira)
  const cartoes = useMemo<CartaoBolsa[]>(() => {
    const cores: Record<string, [string, string]> = { reserva: ['#C99A3A', '#2B1D07'], meta: ['#E9DCC0', '#3B2A0A'], divida: ['#26211A', '#EBCF8B'], liberdade: ['#16503E', '#E4F4EC'] };
    const todos = objetivosDaPessoa(e, hoje);
    const escolhidos = [todos.find((o) => o.tipo === 'reserva'), todos.find((o) => o.tipo === 'meta'), todos.find((o) => o.tipo === 'divida') ?? todos.find((o) => o.tipo === 'liberdade')].filter(Boolean) as typeof todos;
    return escolhidos.map((o) => ({
      rotulo: o.tipo === 'reserva' ? 'Reserva' : o.nome,
      valor: o.formato === 'pct' ? `${Math.round(o.valor)}%` : o.tipo === 'meta' ? `${Math.round(o.pct)}%` : oculto ? mascarar(brl0(o.valor), true) : brl0(o.valor),
      cor: cores[o.tipo][0], corTexto: cores[o.tipo][1],
    }));
  }, [e, hoje, oculto]);
  const cartoesRef = useRef(cartoes); cartoesRef.current = cartoes;
  const abertaRef = useRef(aberta); abertaRef.current = aberta;

  const sync = () => {
    const r = raiz.current; const f = frente.current;
    if (!cena.current || !r || !f || r.offsetWidth < 60) return;
    cena.current.atualizar({ largura: r.offsetWidth, altura: r.offsetHeight, frente: { x: f.offsetLeft, y: f.offsetTop, w: f.offsetWidth, h: f.offsetHeight }, faixa: FAIXA * Math.max(1, cartoesRef.current.length) }, cartoesRef.current, abertaRef.current);
  };
  const syncRef = useRef(sync); syncRef.current = sync;

  useEffect(() => {
    let cancelado = false;
    void import('./bolsa3d').then((m) => {
      if (cancelado || !palco.current) return;
      if (!m.webglDisponivel()) { setSemWebgl(true); return; }
      try { cena.current = m.criarBolsa(palco.current); setTresD(true); syncRef.current(); } catch { setSemWebgl(true); }
    }).catch(() => setSemWebgl(true));
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncRef.current()) : null;
    if (raiz.current) ro?.observe(raiz.current);
    if (frente.current) ro?.observe(frente.current);
    return () => { cancelado = true; ro?.disconnect(); cena.current?.destruir(); cena.current = null; };
  }, []);
  useEffect(() => { sync(); });

  const mover = (ev: ReactPointerEvent<HTMLElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    cena.current?.inclinar((ev.clientX - r.left) / Math.max(1, r.width), (ev.clientY - r.top) / Math.max(1, r.height));
  };
  const compartilhar = async () => {
    if (enviando) return;
    setEnviando(true); tocar('pop');
    try {
      const sobraPct = receitas && receitas > 0 && saldo !== null ? Math.round((saldo / receitas) * 100) : null;
      const saude = e.config.renda > 0 ? saudeFinanceira(e, mes, hoje).nota : null;
      const r = await compartilharMes({ mes: nomeMes(mes).replace(/^./, (c) => c.toLocaleUpperCase('pt-BR')), sobraPct, dias: sequenciaDeDias(e, hoje), saude, reservaPct: meta > 0 ? Math.round(pct * 100) : null, moedas: 6 + Math.round(pct * 22) });
      if (r === 'downloaded') toast('Imagem salva. É só postar.');
    } catch { toast('Não consegui gerar a imagem agora.'); } finally { setEnviando(false); }
  };
  const n = Math.max(1, cartoes.length);

  return (
    <section ref={raiz} className={`bh${tresD ? ' bh-3d' : ''}${semWebgl ? ' bh-flat' : ''}`} style={{ ['--faixa' as string]: `${FAIXA * n}px` }} aria-label="Seu saldo" onPointerMove={mover} onPointerLeave={() => cena.current?.inclinar(0.5, 0.5)}>
      <div className="bh-palco" ref={palco} aria-hidden="true" />
      <button type="button" className="bh-cartoes" onClick={() => { setAberta((a) => !a); tocar('pop'); }} aria-label="Mostrar ou recolher os cartões das contas" aria-pressed={aberta}>
        {semWebgl && cartoes.map((c, i) => <span key={c.rotulo} className="bh-plano" style={{ background: c.cor, color: c.corTexto, top: i * FAIXA }}><b>{c.rotulo}</b><i>{c.valor}</i></span>)}
      </button>
      <div className="bh-frente" ref={frente}>
        <div className="bh-linha">
          <div>
            <small><House size={15} aria-hidden="true" />Saldo total</small>
            <b className="bh-saldo">{saldo === null ? 'R$ —' : <Dinheiro valor={saldo} oculto={oculto} />}</b>
          </div>
          <div className="bh-chips">
            {receitas !== null && <span className="bom"><i aria-hidden="true">↑</i>{oculto ? mascarar(brl0(receitas), true) : brl0(receitas)}</span>}
            {despesas !== null && <span><i aria-hidden="true">↓</i>{oculto ? mascarar(brl0(despesas), true) : brl0(despesas)}</span>}
          </div>
        </div>
        <div className="bh-acoes">
          <button type="button" className="bh-principal" onClick={() => abrirAdicionar()}><Plus size={18} aria-hidden="true" />Gasto</button>
          <Link to="/plano/calendario" className="bh-redondo" aria-label="Calendário de contas"><CalendarDays size={19} aria-hidden="true" /></Link>
          <button type="button" className="bh-redondo" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
          <button type="button" className="bh-redondo ouro" onClick={() => void compartilhar()} aria-label="Compartilhar meu mês" disabled={enviando}><Share2 size={19} aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
}
