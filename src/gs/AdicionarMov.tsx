import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Camera, Check, Copy } from 'lucide-react';
import { painelToken } from '../painel';
import { useEstado } from './store';
import { atalhosFrequentes, sugerirCategoria, sugerirForma } from './sugestoes';
import { comprarNoCartao, criarConta, removerLancamento, removerReceita, removerTransferencia, restaurarLancamento, restaurarReceita, restaurarTransferencia, salvarLancamento, salvarReceita, salvarTransferencia } from './acoes';
import { CATEGORIAS_MOV, type Lancamento, type Receita, type Transferencia } from './tipos';
import { brl, hoje as hojeSP, somaDias } from './datas';
import { iconeDe } from './categorias';
import { Campo, CampoDinheiro, Folha } from './ui';
import { impactoCompra } from './faturaCsv';
import { folgaMensal } from './selectores';
import { mesDe } from './datas';
import { apagarComDesfazer, toast } from '../components/ui/Toast';

/* ---------- "+ Adicionar": despesa, receita ou transferência em 3 passos curtos (valor → categoria → conta e data) ---------- */

export const EVENTO_ADICIONAR = 'gs-adicionar';
type Tipo = 'despesa' | 'receita' | 'transferencia';
export interface PedidoAdicionar {
  tipo?: Tipo;
  receitaTipo?: 'salario' | 'extra';
  editarGasto?: Lancamento;
  editarReceita?: Receita;
  editarTransferencia?: Transferencia;
}
export const abrirAdicionar = (p: PedidoAdicionar = {}) => window.dispatchEvent(new CustomEvent<PedidoAdicionar>(EVENTO_ADICIONAR, { detail: p }));

const FONTES_EXTRA = ['Freelance / bico', 'Venda', '13º salário', 'Bônus / comissão', 'Reembolso', 'Aluguel recebido'];
const FORMAS = ['Pix', 'Débito', 'Crédito', 'Dinheiro'];
const CHAVE_CONTA = 'gs-ultima-conta';
const lerConta = () => { try { return localStorage.getItem(CHAVE_CONTA) ?? ''; } catch { return ''; } };
const guardarConta = (id: string) => { try { localStorage.setItem(CHAVE_CONTA, id); } catch { /* sem armazenamento */ } };

export function AdicionarMov() {
  const e = useEstado();
  const nav = useNavigate();
  const [aberta, setAberta] = useState(false);
  const [passo, setPasso] = useState(1);
  const [tudo, setTudo] = useState(false); // edição: tudo numa tela só
  const [tipo, setTipo] = useState<Tipo>('despesa');
  const [valor, setValor] = useState(0);
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [forma, setForma] = useState('');
  const [rTipo, setRTipo] = useState<'salario' | 'extra'>('extra');
  const [conta, setConta] = useState('');
  const [destino, setDestino] = useState('');
  const [data, setData] = useState(hojeSP());
  const [outraData, setOutraData] = useState(false);
  const [novaConta, setNovaConta] = useState('');
  const [erro, setErro] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [original, setOriginal] = useState<Lancamento | Receita | Transferencia | null>(null);
  const [apagar, setApagar] = useState(false);
  const [parcelasCartao, setParcelasCartao] = useState(1);
  const [avisoCartao, setAvisoCartao] = useState('');
  const contasRef = useRef(e.contas);
  contasRef.current = e.contas;
  const hoje = hojeSP();
  const ontem = somaDias(hoje, -1);
  const atalhos = useMemo(() => atalhosFrequentes(e, hoje), [e, hoje]);

  useEffect(() => {
    const abrir = (ev: Event) => {
      const p = (ev as CustomEvent<PedidoAdicionar>).detail ?? {};
      const g = p.editarGasto, r = p.editarReceita, t = p.editarTransferencia;
      const ultima = lerConta();
      setErro(''); setApagar(false); setNovaConta(''); setParcelasCartao(1); setAvisoCartao('');
      setOriginal(g ?? r ?? t ?? null);
      setEditId(g?.id ?? r?.id ?? t?.id ?? null);
      setTudo(Boolean(g ?? r ?? t));
      setPasso(1);
      setTipo(t ? 'transferencia' : r ? 'receita' : g ? 'despesa' : (p.tipo ?? 'despesa'));
      setValor(g?.valor ?? r?.valor ?? t?.valor ?? 0);
      setDesc(g?.descricao ?? r?.descricao ?? t?.descricao ?? '');
      setCat(g?.categoria ?? '');
      setForma(g?.forma ?? '');
      setRTipo(r?.tipo ?? p.receitaTipo ?? 'extra');
      setConta(g?.contaId ?? r?.contaId ?? t?.de ?? (contasRef.current.some((c) => c.id === ultima) ? ultima : ''));
      setDestino(t?.para ?? '');
      setData(g?.data ?? r?.data ?? t?.data ?? hojeSP());
      setOutraData(Boolean((g?.data ?? r?.data ?? t?.data) && (g?.data ?? r?.data ?? t?.data) !== hojeSP() && (g?.data ?? r?.data ?? t?.data) !== somaDias(hojeSP(), -1)));
      setAberta(true);
    };
    window.addEventListener(EVENTO_ADICIONAR, abrir);
    return () => window.removeEventListener(EVENTO_ADICIONAR, abrir);
  }, []);

  const fechar = () => setAberta(false);
  const [lendo, setLendo] = useState(false);
  /** Anotar por foto: a mesma leitura do WhatsApp. O que vier preenche o formulário, e a pessoa confere antes de salvar. */
  const lerFoto = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 3_000_000) return setErro('Foto grande demais (máximo 3 MB).');
    setLendo(true);
    setErro('');
    try {
      const data = await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = falha; r.readAsDataURL(f); });
      const res = await fetch('/api/comprovante', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${painelToken() ?? ''}` }, body: JSON.stringify({ mediaType: f.type, data }) });
      const j = (await res.json().catch(() => ({}))) as { comprovante?: { tipo: string; valor: number; descricao: string; forma_pagamento: string; data: string }; error?: string };
      if (!j.comprovante) return setErro(j.error ?? 'Não consegui ler a foto agora. Anote o valor à mão.');
      const c = j.comprovante;
      setTipo(c.tipo === 'recebimento' ? 'receita' : 'despesa');
      setValor(c.valor);
      setDesc(c.descricao);
      if (c.tipo !== 'recebimento') { setCat(sugerirCategoria(c.descricao, CATEGORIAS_MOV) ?? 'Outros'); setForma(FORMAS.includes(c.forma_pagamento) ? c.forma_pagamento : ''); }
      if (/^\d{4}-\d{2}-\d{2}$/.test(c.data) && c.data <= hojeSP()) { setData(c.data); setOutraData(c.data !== hojeSP() && c.data !== somaDias(hojeSP(), -1)); }
      setTudo(true);
      toast('Li a foto. Confira e salve.');
    } catch {
      setErro('Sem conexão agora. Anote o valor à mão.');
    } finally {
      setLendo(false);
    }
  };
  const mudarDesc = (t: string) => {
    setDesc(t);
    if (tipo === 'despesa') {
      const s = sugerirCategoria(t, CATEGORIAS_MOV);
      if (s) setCat(s);
      if (!forma) { const f = sugerirForma(t); if (f) setForma(f); }
    }
  };
  const criarRapido = () => {
    const id = criarConta(novaConta);
    if (!id) return setErro('Não consegui criar a conta (nome repetido ou limite de 12).');
    setNovaConta(''); setErro('');
    if (!conta) setConta(id); else if (tipo === 'transferencia' && !destino) setDestino(id);
  };

  const validar1 = () => (!(valor > 0) ? 'Digite o valor.' : '');
  const validarTransf = () => (tipo !== 'transferencia' ? '' : !conta || !destino ? 'Escolha a conta de origem e a de destino.' : conta === destino ? 'Origem e destino precisam ser diferentes.' : '');
  const proximo = () => {
    const m = passo === 1 ? validar1() : passo === 2 ? validarTransf() : '';
    if (m) return setErro(m);
    setErro('');
    setPasso(passo + 1);
  };

  const salvar = (ev?: React.FormEvent) => {
    ev?.preventDefault();
    const m = validar1() || validarTransf();
    if (m) { setErro(m); if (!tudo) setPasso(validar1() ? 1 : 2); return; }
    if (data > hojeSP()) return setErro('A data não pode ser no futuro.');
    if (conta) guardarConta(conta);
    // compra no crédito com cartão cadastrado: entra na fatura (e nas parcelas), não vira gasto à parte, para não contar duas vezes
    if (tipo === 'despesa' && forma === 'Crédito' && e.cartao && !editId) {
      const imp = impactoCompra(e.cartao, { valor, parcelas: parcelasCartao }, folgaMensal(e, mesDe(hojeSP())).folga);
      if (imp.veredito !== 'cabe' && avisoCartao !== `${valor}:${parcelasCartao}`) {
        setAvisoCartao(`${valor}:${parcelasCartao}`);
        setErro('');
        return;
      }
      if (!comprarNoCartao({ descricao: desc || cat || 'Compra', valor, parcelas: parcelasCartao })) return setErro('Não consegui registrar no cartão.');
      toast(parcelasCartao > 1 ? `Compra no cartão: ${parcelasCartao}x de ${brl(valor / parcelasCartao)}` : `Compra no cartão: ${brl(valor)} na fatura`);
      return fechar();
    }
    if (tipo === 'despesa') {
      if (!salvarLancamento({ id: editId ?? undefined, descricao: desc, valor, data, categoria: cat || 'Outros', forma: forma || undefined, contaId: conta || undefined, serverId: (original as Lancamento | null)?.serverId })) return setErro('Confira os dados e tente de novo.');
      toast(`${editId ? 'Gasto atualizado' : 'Gasto anotado'}: ${brl(valor)} em ${cat || 'Outros'}`);
    } else if (tipo === 'receita') {
      if (!salvarReceita({ id: editId ?? undefined, descricao: desc, valor, data, tipo: rTipo, contaId: conta || undefined, serverId: (original as Receita | null)?.serverId })) return setErro('Confira os dados e tente de novo.');
      if (rTipo === 'extra' && !editId) toast(`Renda extra registrada: +${brl(valor)} no que você tem este mês`, { acao: { rotulo: 'Melhor destino', onClick: () => nav('/plano/extras') } });
      else toast(`${editId ? 'Receita atualizada' : 'Receita registrada'}: ${brl(valor)}`);
    } else {
      if (!salvarTransferencia({ id: editId ?? undefined, data, valor, de: conta, para: destino, descricao: desc })) return setErro('Confira os dados e tente de novo.');
      toast(`Transferência registrada: ${brl(valor)}`);
    }
    fechar();
  };

  const excluir = () => {
    if (!original || !editId) return;
    if (tipo === 'despesa') { const l = original as Lancamento; removerLancamento(l.id); apagarComDesfazer(`${l.descricao} apagado`, () => restaurarLancamento(l)); }
    else if (tipo === 'receita') { const r = original as Receita; removerReceita(r.id); apagarComDesfazer(`${r.descricao} apagada`, () => restaurarReceita(r)); }
    else { const t = original as Transferencia; removerTransferencia(t.id); apagarComDesfazer('Transferência apagada', () => restaurarTransferencia(t)); }
    fechar();
  };
  const duplicar = () => {
    if (tipo === 'despesa') salvarLancamento({ descricao: desc, valor, data: hojeSP(), categoria: cat || 'Outros', forma: forma || undefined, contaId: conta || undefined });
    else if (tipo === 'receita') salvarReceita({ descricao: desc, valor, data: hojeSP(), tipo: rTipo, contaId: conta || undefined });
    else salvarTransferencia({ data: hojeSP(), valor, de: conta, para: destino, descricao: desc });
    toast('Lançamento duplicado com a data de hoje');
    fechar();
  };

  const ver = (n: number) => tudo || passo === n;
  const titulo = editId ? 'Editar lançamento' : 'Adicionar';
  const rotuloTipo: Record<Tipo, string> = { despesa: 'Despesa', receita: 'Receita', transferencia: 'Transferir' };

  return (
    <Folha aberta={aberta} onFechar={fechar} titulo={titulo}>
      <form onSubmit={salvar} noValidate>
        {!tudo && (
          <div className="gs-passos" aria-label={`Passo ${passo} de 3`}>
            {passo > 1 && <button type="button" className="gs-icone-btn" aria-label="Voltar" onClick={() => { setErro(''); setPasso(passo - 1); }}><ArrowLeft size={18} /></button>}
            <span>{[1, 2, 3].map((n) => <i key={n} className={n <= passo ? 'on' : ''} />)}</span>
            <small>Passo {passo} de 3</small>
          </div>
        )}

        {ver(1) && (
          <section>
            {!editId && (
              <div className="gs-seg" role="group" aria-label="Tipo">
                {(Object.keys(rotuloTipo) as Tipo[]).map((t) => <button key={t} type="button" className={tipo === t ? 'on' : ''} onClick={() => { setTipo(t); setErro(''); }}>{rotuloTipo[t]}</button>)}
              </div>
            )}
            {tipo === 'despesa' && !editId && atalhos.length > 0 && (
              <div className="gs-chips" role="group" aria-label="Atalhos dos seus gastos frequentes">
                {atalhos.map((a) => (
                  <button key={a.descricao} type="button" className="gs-chip" onClick={() => { setDesc(a.descricao); setCat(a.categoria); setValor(a.valor); setPasso(3); }}>{a.descricao} · {brl(a.valor)}</button>
                ))}
              </div>
            )}
            {!editId && tipo !== 'transferencia' && !tudo && (
              <label className="gs-btn sec" style={{ width: '100%', marginBottom: 12, cursor: 'pointer' }} aria-busy={lendo}>
                <Camera size={18} aria-hidden="true" />{lendo ? 'Lendo a foto…' : 'Anotar por foto (cupom ou pix)'}
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only" disabled={lendo} onChange={(ev) => { void lerFoto(ev.target.files?.[0]); ev.target.value = ''; }} />
              </label>
            )}
            <CampoDinheiro rotulo={tipo === 'receita' ? 'Quanto recebeu?' : tipo === 'transferencia' ? 'Quanto vai transferir?' : 'Quanto gastou?'} valor={valor} onChange={setValor} grande autoFocus erro={erro && !(valor > 0) ? erro : undefined} />
          </section>
        )}

        {ver(2) && (
          <section>
            {tipo === 'despesa' && (
              <>
                <Campo rotulo="O que foi? (opcional)" valor={desc} onChange={mudarDesc} placeholder="Ex.: mercado, uber, netflix" maxLength={80} />
                <div className="gs-cats" role="group" aria-label="Categoria">
                  {CATEGORIAS_MOV.map((c) => { const I = iconeDe(c); return (
                    <button key={c} type="button" className={`gs-cat ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => { setCat(c); if (!tudo) setPasso(3); }}><I size={22} aria-hidden="true" /><span>{c}</span></button>
                  ); })}
                </div>
              </>
            )}
            {tipo === 'receita' && (
              <>
                <Campo rotulo="De onde veio? (opcional)" valor={desc} onChange={setDesc} placeholder="Ex.: salário, freela" maxLength={80} />
                <div className="gs-chips" role="group" aria-label="Fontes de renda extra">
                  {FONTES_EXTRA.map((f) => <button key={f} type="button" className="gs-chip" onClick={() => { setDesc(f); setRTipo('extra'); }}>{f}</button>)}
                </div>
                <div className="gs-chips" role="group" aria-label="Tipo de receita">
                  <button type="button" className={`gs-chip ${rTipo === 'salario' ? 'on' : ''}`} onClick={() => setRTipo('salario')}>Salário / renda do mês</button>
                  <button type="button" className={`gs-chip ${rTipo === 'extra' ? 'on' : ''}`} onClick={() => setRTipo('extra')}>Renda extra (fora o salário)</button>
                </div>
              </>
            )}
            {tipo === 'transferencia' && (
              <>
                <span className="gs-rotulo">De</span>
                <div className="gs-chips" role="group" aria-label="Conta de origem">{e.contas.map((c) => <button key={c.id} type="button" className={`gs-chip ${conta === c.id ? 'on' : ''}`} onClick={() => setConta(c.id)}>{c.nome}</button>)}</div>
                <span className="gs-rotulo"><ArrowRightLeft size={12} aria-hidden="true" /> Para</span>
                <div className="gs-chips" role="group" aria-label="Conta de destino">{e.contas.map((c) => <button key={c.id} type="button" className={`gs-chip ${destino === c.id ? 'on' : ''}`} onClick={() => setDestino(c.id)}>{c.nome}</button>)}</div>
                {e.contas.length < 2 && <p className="gs-nota">Para transferir, cadastre pelo menos duas contas (ex.: Banco e Carteira).</p>}
                <div className="gs-novaconta"><input value={novaConta} onChange={(ev) => setNovaConta(ev.target.value)} placeholder="Nova conta" maxLength={30} aria-label="Nome da nova conta" /><button type="button" className="gs-btn sec pequeno" onClick={criarRapido} disabled={!novaConta.trim()}>Criar</button></div>
                <Campo rotulo="Observação (opcional)" valor={desc} onChange={setDesc} maxLength={80} />
              </>
            )}
            {!tudo && tipo !== 'despesa' && <button type="button" className="gs-btn cheio" onClick={proximo}>Continuar</button>}
          </section>
        )}

        {ver(3) && (
          <section>
            {tipo !== 'transferencia' && (
              <>
                <span className="gs-rotulo">Conta</span>
                <div className="gs-chips" role="group" aria-label="Conta">
                  <button type="button" className={`gs-chip ${conta === '' ? 'on' : ''}`} onClick={() => setConta('')}>Sem conta</button>
                  {e.contas.map((c) => <button key={c.id} type="button" className={`gs-chip ${conta === c.id ? 'on' : ''}`} onClick={() => setConta(c.id)}>{c.nome}</button>)}
                </div>
                <div className="gs-novaconta"><input value={novaConta} onChange={(ev) => setNovaConta(ev.target.value)} placeholder="Nova conta (opcional)" maxLength={30} aria-label="Nome da nova conta" /><button type="button" className="gs-btn sec pequeno" onClick={criarRapido} disabled={!novaConta.trim()}>Criar</button></div>
              </>
            )}
            <span className="gs-rotulo">Data</span>
            <div className="gs-chips" role="group" aria-label="Data">
              <button type="button" className={`gs-chip ${data === hoje && !outraData ? 'on' : ''}`} onClick={() => { setData(hoje); setOutraData(false); }}>Hoje</button>
              <button type="button" className={`gs-chip ${data === ontem && !outraData ? 'on' : ''}`} onClick={() => { setData(ontem); setOutraData(false); }}>Ontem</button>
              <button type="button" className={`gs-chip ${outraData ? 'on' : ''}`} onClick={() => setOutraData(true)}>Outro dia</button>
            </div>
            {outraData && <Campo rotulo="Data" valor={data} onChange={setData} tipo="date" />}
            {tipo === 'despesa' && e.cartao && (
              <>
                <span className="gs-rotulo">Como pagou?</span>
                <div className="gs-chips" role="group" aria-label="Forma de pagamento">{FORMAS.map((f) => <button key={f} type="button" className={`gs-chip ${forma === f ? 'on' : ''}`} aria-pressed={forma === f} onClick={() => { setForma(forma === f ? '' : f); setAvisoCartao(''); }}>{f}</button>)}</div>
              </>
            )}
            {tipo === 'despesa' && !e.cartao && (
              <details className="gs-avancado">
                <summary>Mais opções (forma de pagamento)</summary>
                <div className="gs-chips" role="group" aria-label="Forma de pagamento">{FORMAS.map((f) => <button key={f} type="button" className={`gs-chip ${forma === f ? 'on' : ''}`} onClick={() => setForma(forma === f ? '' : f)}>{f}</button>)}</div>
              </details>
            )}
            {tipo === 'despesa' && forma === 'Crédito' && e.cartao && !editId && (
              <>
                <span className="gs-rotulo">Parcelas no cartão</span>
                <div className="gs-chips" role="group" aria-label="Parcelas no cartão">
                  {[1, 2, 3, 6, 10, 12].map((x) => <button key={x} type="button" className={`gs-chip ${parcelasCartao === x ? 'on' : ''}`} aria-pressed={parcelasCartao === x} onClick={() => { setParcelasCartao(x); setAvisoCartao(''); }}>{x === 1 ? 'À vista' : `${x}x`}</button>)}
                </div>
                {valor > 0 && <AvisoCartao c={e.cartao} valor={valor} n={parcelasCartao} folga={folgaMensal(e, mesDe(hoje)).folga} confirmado={avisoCartao === `${valor}:${parcelasCartao}`} />}
              </>
            )}
            {!tudo && tipo === 'despesa' && !cat && <p className="gs-nota">Sem categoria, o gasto entra em "Outros".</p>}
          </section>
        )}

        {erro && !(erro === 'Digite o valor.' && !(valor > 0) && ver(1)) && <p role="alert" style={{ color: 'var(--danger)' }}>{erro}</p>}
        {(tudo || passo === 3 || (passo === 2 && tipo === 'despesa')) && (
          <div className="gs-acoes">
            <button type="submit" className="gs-btn cheio"><Check size={16} aria-hidden="true" /> {avisoCartao === `${valor}:${parcelasCartao}` ? 'Registrar mesmo assim' : 'Salvar'}</button>
            {editId && <button type="button" className="gs-btn sec" onClick={duplicar}><Copy size={16} aria-hidden="true" /> Duplicar</button>}
            {editId && !apagar && <button type="button" className="gs-btn link" onClick={() => setApagar(true)}>Excluir</button>}
            {editId && apagar && <button type="button" className="gs-btn perigo" onClick={excluir}>Confirmar exclusão</button>}
          </div>
        )}
        {!tudo && passo === 1 && <button type="button" className="gs-btn cheio" onClick={proximo}>Continuar</button>}
        {!tudo && passo === 1 && (
          <p className="gs-nota">É uma <button type="button" className="gs-btn link" onClick={() => { fechar(); nav('/plano/atrasos?anotar=1'); }}>conta atrasada</button> ou uma <button type="button" className="gs-btn link" onClick={() => { fechar(); nav('/plano/dividas'); }}>dívida</button>? Anote ali.</p>
        )}
      </form>
    </Folha>
  );
}

/** Antes de registrar no crédito: cabe no plano? Só avisa (a decisão é da pessoa). */
function AvisoCartao({ c, valor, n, folga, confirmado }: { c: NonNullable<import('./tipos').Estado['cartao']>; valor: number; n: number; folga: number; confirmado: boolean }) {
  const i = impactoCompra(c, { valor, parcelas: n }, folga);
  const tom = i.veredito === 'cabe' ? 'ok' : i.veredito === 'aperta' ? 'aviso' : 'erro';
  return (
    <p className={`gs-banner ${tom}`} role={i.veredito === 'cabe' ? 'status' : 'alert'} style={confirmado ? { borderColor: 'var(--danger)' } : undefined}>
      <b>{i.veredito === 'cabe' ? 'Cabe no seu plano.' : i.veredito === 'aperta' ? 'Isso aperta o seu mês.' : 'Isso não cabe no seu plano.'}</b> {i.motivo} A fatura iria a {brl(i.faturaDepois)}.{i.veredito !== 'cabe' ? ' Toque em "Registrar mesmo assim" se for seguir.' : ''}
    </p>
  );
}
