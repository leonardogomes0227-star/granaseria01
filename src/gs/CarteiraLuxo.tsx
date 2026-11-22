// A carteira do Início: couro escuro, costura dourada, cartões aparecendo por trás e o saldo do mês em destaque.
// Tudo vem dos números que o app já calcula. O botão de compartilhar gera uma imagem sem valores em reais.

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Eye, EyeOff, House, Plus, Share2 } from 'lucide-react';
import { brl0, mesDe, nomeMes } from './datas';
import { useContagem } from './base';
import { painelVidro } from './painelVidro';
import { definirOculto, mascarar, useOculto } from './privacidade';
import { sequenciaDeDias } from './selectores';
import { saudeFinanceira } from './saude';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { abrirAdicionar } from './AdicionarMov';
import { compartilharMes } from './cartaoDoMes';
import { tocar } from './sons';
import { toast } from '../components/ui/Toast';
import './carteira.css';

function Dinheiro({ valor, oculto }: { valor: number; oculto: boolean }) {
  const n = useContagem(valor, 1100);
  return <>{oculto ? mascarar(brl0(valor), true) : brl0(n)}</>;
}

export function CarteiraLuxo() {
  const e = useEstado();
  const hoje = useHoje();
  const oculto = useOculto();
  const mes = mesDe(hoje);
  const p = useMemo(() => painelVidro(e, hoje), [e, hoje]);
  const [aberta, setAberta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const kpi = (id: string) => p.kpis.find((k) => k.id === id);
  const saldo = kpi('saldo')?.valor ?? null;
  const receitas = kpi('receitas')?.valor ?? null;
  const despesas = kpi('despesas')?.valor ?? null;
  const guardado = kpi('patrimonio')?.valor ?? kpi('guardado')?.valor ?? null;

  // até três cartões: o que a pessoa tem de mais relevante para mostrar
  const cartoes = useMemo(() => {
    const lista: { rotulo: string; valor: string; compartilha: string; tom: 'ouro' | 'onix' | 'vinho' }[] = [];
    if (guardado !== null && guardado > 0) lista.push({ rotulo: 'Guardado', valor: brl0(guardado), compartilha: 'reserva em andamento', tom: 'ouro' });
    const meta = p.metas[0];
    if (meta) lista.push({ rotulo: meta.nome, valor: `${meta.pct}%`, compartilha: `${meta.pct}%`, tom: 'onix' });
    const div = p.dividas[0];
    if (div) lista.push({ rotulo: div.nome, valor: brl0(div.saldo), compartilha: `${Math.round(div.pctPago)}% pago`, tom: 'vinho' });
    const conta = p.contas[0];
    if (conta && lista.length < 3) lista.push({ rotulo: conta.nome, valor: brl0(conta.valor), compartilha: conta.pilula, tom: lista.length === 0 ? 'ouro' : 'vinho' });
    return lista.slice(0, 3);
  }, [guardado, p.metas, p.dividas, p.contas]);

  const inclinar = (ev: ReactPointerEvent<HTMLElement>) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const px = (ev.clientX - r.left) / Math.max(1, r.width);
    const py = (ev.clientY - r.top) / Math.max(1, r.height);
    ev.currentTarget.style.setProperty('--rx', `${((0.5 - py) * 6).toFixed(2)}deg`);
    ev.currentTarget.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`);
    ev.currentTarget.style.setProperty('--bx', `${(px * 100).toFixed(1)}%`);
  };
  const soltar = (ev: ReactPointerEvent<HTMLElement>) => { ev.currentTarget.style.setProperty('--rx', '0deg'); ev.currentTarget.style.setProperty('--ry', '0deg'); };

  const compartilhar = async () => {
    if (enviando) return;
    setEnviando(true);
    tocar('pop');
    try {
      const sobraPct = receitas && receitas > 0 && saldo !== null ? Math.round((saldo / receitas) * 100) : null;
      const saude = e.config.renda > 0 ? saudeFinanceira(e, mes, hoje).nota : null;
      const r = await compartilharMes({
        mes: nomeMes(mes).replace(/^./, (c) => c.toLocaleUpperCase('pt-BR')),
        sobraPct,
        dias: sequenciaDeDias(e, hoje),
        saude,
        cartoes: cartoes.map((c) => ({ rotulo: c.rotulo, valor: c.compartilha })),
      });
      if (r === 'downloaded') toast('Imagem salva. É só postar.');
    } catch {
      toast('Não consegui gerar a imagem agora.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className={`cl${aberta ? ' aberta' : ''}`} aria-label="Sua carteira do mês" onPointerMove={inclinar} onPointerLeave={soltar}>
      <div className="cl-cartoes" onClick={() => { setAberta((a) => !a); tocar('pop'); }} role="button" tabIndex={0} aria-label="Mostrar ou recolher os cartões" onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setAberta((a) => !a); } }}>
        {cartoes.map((c, i) => (
          <div key={c.rotulo} className={`cl-cartao ${c.tom}`} style={{ ['--i' as string]: String(i), animationDelay: `${0.1 + i * 0.12}s` }}>
            <b>{c.rotulo}</b><span>{oculto ? mascarar(c.valor, true) : c.valor}</span>
          </div>
        ))}
      </div>
      <div className="cl-bolsa">
        <div className="cl-brilho" aria-hidden="true" />
        <div className="cl-topo">
          <small><House size={15} aria-hidden="true" />Saldo do mês</small>
          <span className="cl-mes">{nomeMes(mes).split(' ')[0]}</span>
        </div>
        <div className="cl-meio">
          <b className="cl-saldo">{saldo === null ? 'R$ —' : <Dinheiro valor={saldo} oculto={oculto} />}</b>
          <div className="cl-chips">
            {despesas !== null && <span><i aria-hidden="true">↓</i>{oculto ? mascarar(brl0(despesas), true) : brl0(despesas)}<em>gastos</em></span>}
            {receitas !== null && <span className="verde"><i aria-hidden="true">↑</i>{oculto ? mascarar(brl0(receitas), true) : brl0(receitas)}<em>entrou</em></span>}
          </div>
        </div>
        <div className="cl-acoes">
          <button type="button" className="cl-principal" onClick={() => abrirAdicionar()}><Plus size={18} aria-hidden="true" />Gasto</button>
          <Link to="/plano/calendario" className="cl-redondo" aria-label="Calendário de contas"><CalendarDays size={19} aria-hidden="true" /></Link>
          <button type="button" className="cl-redondo" onClick={() => definirOculto(!oculto)} aria-pressed={oculto} aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}>{oculto ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button>
          <button type="button" className="cl-redondo ouro" onClick={() => void compartilhar()} aria-label="Compartilhar meu mês" disabled={enviando}><Share2 size={19} aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
}
