// O topo do Início: saldo do mês em destaque e, ao lado, a pilha de ouro em 3D que cresce conforme a pessoa guarda.
// Tudo vem dos números que o app já calcula. O botão de compartilhar gera uma imagem sem valores em reais.

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Eye, EyeOff, Plus, Share2 } from 'lucide-react';
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
import { tocar } from './sons';
import { toast } from '../components/ui/Toast';
import type { CenaOuro } from './ouro3d';

function Dinheiro({ valor, oculto }: { valor: number; oculto: boolean }) {
  const n = useContagem(valor, 700);
  return <>{oculto ? mascarar(brl0(valor), true) : brl0(n)}</>;
}

export function OuroHero() {
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
  const pilha = useMemo(() => ({ moedas: 6 + Math.round(pct * 22), barras: Math.min(4, Math.floor(pct * 4)) }), [guardado, pct]);
  const [semWebgl, setSemWebgl] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const palco = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaOuro | null>(null);
  const pilhaRef = useRef(pilha);
  pilhaRef.current = pilha;

  useEffect(() => {
    let cancelado = false;
    void import('./ouro3d').then((m) => {
      if (cancelado || !palco.current) return;
      if (!m.webglDisponivel()) { setSemWebgl(true); return; }
      try { cena.current = m.criarCena(palco.current); cena.current.definir(pilhaRef.current); } catch { setSemWebgl(true); }
    }).catch(() => setSemWebgl(true));
    return () => { cancelado = true; cena.current?.destruir(); cena.current = null; };
  }, []);
  useEffect(() => { cena.current?.definir(pilha); }, [pilha]);

  const mover = (ev: ReactPointerEvent<HTMLElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    cena.current?.inclinar((ev.clientX - r.left) / Math.max(1, r.width), (ev.clientY - r.top) / Math.max(1, r.height));
  };

  const compartilhar = async () => {
    if (enviando) return;
    setEnviando(true);
    tocar('pop');
    try {
      const sobraPct = receitas && receitas > 0 && saldo !== null ? Math.round((saldo / receitas) * 100) : null;
      const saude = e.config.renda > 0 ? saudeFinanceira(e, mes, hoje).nota : null;
      const r = await compartilharMes({ mes: nomeMes(mes).replace(/^./, (c) => c.toLocaleUpperCase('pt-BR')), sobraPct, dias: sequenciaDeDias(e, hoje), saude, reservaPct: meta > 0 ? Math.round(pct * 100) : null, moedas: pilha.moedas });
      if (r === 'downloaded') toast('Imagem salva. É só postar.');
    } catch {
      toast('Não consegui gerar a imagem agora.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="oh" aria-label="Seu mês" onPointerMove={mover} onPointerLeave={() => cena.current?.inclinar(0.5, 0.5)}>
      <div className={`oh-ouro${semWebgl ? ' estatico' : ''}`} ref={palco} aria-hidden="true">{semWebgl && <i className="oh-moeda">S</i>}</div>
      <div className="oh-texto">
        <div className="oh-topo"><small>Saldo do mês</small><span>{nomeMes(mes).split(' ')[0]}</span></div>
        <b className="oh-saldo">{saldo === null ? 'R$ —' : <Dinheiro valor={saldo} oculto={oculto} />}</b>
        <div className="oh-chips">
          {despesas !== null && <span><i aria-hidden="true">↓</i>{oculto ? mascarar(brl0(despesas), true) : brl0(despesas)}<em>gastos</em></span>}
          {receitas !== null && <span className="bom"><i aria-hidden="true">↑</i>{oculto ? mascarar(brl0(receitas), true) : brl0(receitas)}<em>entrou</em></span>}
        </div>
      </div>
      <div className="oh-reserva">
        <div><small>Sua reserva</small><b>{oculto ? mascarar(brl0(guardado), true) : brl0(guardado)}{meta > 0 && <em> de {oculto ? mascarar(brl0(meta), true) : brl0(meta)}</em>}</b></div>
        <div className="oh-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Reserva de emergência"><i style={{ width: `${Math.max(2, pct * 100)}%` }} /></div>
      </div>
      <div className="oh-acoes">
        <button type="button" className="oh-principal" onClick={() => abrirAdicionar()}><Plus size={18} aria-hidden="true" />Gasto</button>
        <Link to="/plano/calendario" className="oh-redondo" aria-label="Calendário de contas"><CalendarDays size={19} aria-hidden="true" /></Link>
        <button type="button" className="oh-redondo" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
        <button type="button" className="oh-redondo ouro" onClick={() => void compartilhar()} aria-label="Compartilhar meu mês" disabled={enviando}><Share2 size={19} aria-hidden="true" /></button>
      </div>
    </section>
  );
}
