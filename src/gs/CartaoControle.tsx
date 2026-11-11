import { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { removerOutroCartao, restaurarOutroCartao, salvarCartao, salvarOutroCartao } from './acoes';
import { analiseFatura, aplicarFatura, impactoCompra, parceladasDaFatura, totalFatura, type LeituraFatura } from './faturaCsv';
import { proximasFaturas } from './cartaoLogica';
import { lerArquivoFatura, lerTextoDaFatura } from './lerArquivoFatura';
import { folgaMensal } from './selectores';
import { brl, brl0, mesCurto, mesDe, novoId, somaMes } from './datas';
import { iconeDe } from './categorias';
import { Barra, Campo, CampoDinheiro, CampoNumero, Folha } from './ui';
import { apagarComDesfazer, toast } from '../components/ui/Toast';
import { proximaData } from './cartaoLogica';
import type { Cartao, OutroCartao } from './tipos';

/* ---------- Cartão sob controle: projeção das parcelas, limite do mês, simulador de compra e importar fatura ---------- */

export function CartaoControle({ c }: { c: Cartao }) {
  const e = useEstado();
  const hoje = useHoje();
  const renda = e.config.renda;
  const [simular, setSimular] = useState(false);
  const [importar, setImportar] = useState(() => typeof window !== 'undefined' && window.location.hash === '#importar');
  const [limite, setLimite] = useState(false);
  const [outro, setOutro] = useState<OutroCartao | 'novo' | null>(null);
  const meses = useMemo(() => proximasFaturas(c, 6), [c]);
  const max = Math.max(...meses, 1);
  const lim = c.limitePessoal;
  const uso = lim ? (c.usado / lim) * 100 : 0;
  const outros = e.outrosCartoes ?? [];
  const totalFaturas = c.usado + outros.reduce((t, o) => t + o.usado, 0);
  const linhaCartao = (nome: string, usado: number, limiteBanco: number, venceDia: number, extra?: OutroCartao) => {
    const v = proximaData(venceDia, hoje);
    return (
      <div className="gs-linha" key={extra?.id ?? 'principal'}>
        <div className="gs-corpo"><b>{nome}</b><small>vence dia {venceDia} ({v.dias === 0 ? 'hoje' : `em ${v.dias} ${v.dias === 1 ? 'dia' : 'dias'}`}){limiteBanco > 0 ? ` · ${Math.round((usado / limiteBanco) * 100)}% do limite` : ''}</small></div>
        <span className="gs-valor">{brl0(usado)}</span>
        {extra && <button type="button" className="gs-btn link" onClick={() => setOutro(extra)}>Editar</button>}
      </div>
    );
  };
  return (
    <>
      {outros.length > 0 && (
        <section className="gs-card" aria-label="Todas as faturas">
          <span className="gs-rotulo">Todas as faturas</span>
          {linhaCartao('Cartão principal', c.usado, c.limite, c.venceDia)}
          {outros.map((o) => linhaCartao(o.nome, o.usado, o.limite, o.venceDia, o))}
          <p style={{ margin: '8px 0 0' }}>Total em aberto: <b>{brl0(totalFaturas)}</b></p>
        </section>
      )}

      <section className="gs-card" aria-label="Parcelas nos próximos meses">
        <span className="gs-rotulo">Parcelas já combinadas</span>
        {meses.every((v) => v === 0) ? (
          <p className="gs-mudo" style={{ margin: '6px 0 0' }}>Nenhuma parcela futura. Compras parceladas aparecem aqui nos próximos meses.</p>
        ) : (
          meses.map((v, i) => {
            const m = mesCurto(somaMes(mesDe(hoje), i + 1));
            return (
              <div key={m} className="gs-proj-linha">
                <span className="gs-mudo">{m}</span>
                <Barra pct={(v / max) * 100} rotulo={`Parcelas em ${m}`} />
                <b className="gs-tab">{brl0(v)}{renda > 0 && v > 0 ? <small className="gs-mudo"> · {Math.round((v / renda) * 100)}%</small> : null}</b>
              </div>
            );
          })
        )}
        {renda > 0 && <p className="gs-nota">A porcentagem é quanto da sua renda mensal já está comprometida só com parcelas.</p>}
      </section>

      <section className="gs-card" aria-label="Limite do mês">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="gs-rotulo">Meu limite para a fatura</span>
          <button type="button" className="gs-btn link" onClick={() => setLimite(true)}>{lim ? 'Alterar' : 'Definir'}</button>
        </div>
        {lim ? (
          <>
            <p style={{ margin: '4px 0 6px' }}>{brl0(c.usado)} de {brl0(lim)} {uso > 100 ? <span className="gs-badge erro">passou</span> : uso >= 80 ? <span className="gs-badge aviso">perto</span> : null}</p>
            <Barra pct={uso} tom={uso > 100 ? 'perigo' : uso < 80 ? 'ok' : ''} rotulo="Fatura em relação ao seu limite" />
          </>
        ) : <p className="gs-mudo" style={{ margin: '4px 0 0' }}>Escolha quanto aceita gastar no cartão por fatura. Eu aviso antes de uma compra passar disso.</p>}
      </section>

      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={() => setSimular(true)}>Simular uma compra</button>
        <button type="button" className="gs-btn sec" onClick={() => setImportar(true)}><Upload size={16} aria-hidden="true" /> Importar fatura</button>
        <button type="button" className="gs-btn link" onClick={() => setOutro('novo')}>+ Outro cartão</button>
      </div>
      <OutroCartaoSheet valor={outro} onFechar={() => setOutro(null)} />

      <LimiteSheet aberta={limite} c={c} onFechar={() => setLimite(false)} />
      <SimuladorSheet aberta={simular} c={c} folga={folgaMensal(e, mesDe(hoje)).folga} renda={renda} onFechar={() => setSimular(false)} />
      <ImportarSheet aberta={importar} c={c} onFechar={() => setImportar(false)} />
    </>
  );
}

function LimiteSheet({ aberta, c, onFechar }: { aberta: boolean; c: Cartao; onFechar: () => void }) {
  const [v, setV] = useState(c.limitePessoal ?? Math.round(c.limite * 0.3));
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Meu limite para a fatura">
      <form onSubmit={(ev) => { ev.preventDefault(); salvarCartao({ ...c, limitePessoal: v > 0 ? v : undefined }); toast(v > 0 ? `Limite do mês: ${brl0(v)}` : 'Limite removido'); onFechar(); }}>
        <CampoDinheiro rotulo="Quanto aceito gastar por fatura" valor={v} onChange={setV} grande autoFocus />
        <p className="gs-nota">Uma regra comum é usar até 30% do limite do banco ({brl0(c.limite * 0.3)}). Deixe em branco para não ter limite próprio.</p>
        <div className="gs-acoes"><button type="submit" className="gs-btn cheio">Salvar</button></div>
      </form>
    </Folha>
  );
}

const VEREDITO = { cabe: ['Cabe no seu mês', 'ok'], aperta: ['Aperta o seu mês', 'aviso'], 'nao-cabe': ['Não cabe agora', 'erro'] } as const;

function SimuladorSheet({ aberta, c, folga, renda, onFechar }: { aberta: boolean; c: Cartao; folga: number; renda: number; onFechar: () => void }) {
  const hoje = useHoje();
  const [valor, setValor] = useState(0);
  const [n, setN] = useState<number | ''>(1);
  const r = valor > 0 ? impactoCompra(c, { valor, parcelas: typeof n === 'number' && n > 0 ? n : 1 }, folga) : null;
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Simular uma compra">
      <CampoDinheiro rotulo="Quanto custa?" valor={valor} onChange={setValor} grande autoFocus />
      <div className="gs-chips" role="group" aria-label="Parcelas">
        {[1, 2, 3, 6, 10, 12].map((x) => <button key={x} type="button" className={`gs-chip ${n === x ? 'on' : ''}`} aria-pressed={n === x} onClick={() => setN(x)}>{x === 1 ? 'À vista' : `${x}x`}</button>)}
      </div>
      <CampoNumero rotulo="Outro número de parcelas" valor={n} onChange={setN} min={1} max={48} placeholder="Ex.: 8" />
      {r ? (
        <div className="gs-card" aria-live="polite">
          <span className={`gs-badge ${VEREDITO[r.veredito][1]}`}>{VEREDITO[r.veredito][0]}</span>
          <p style={{ margin: '8px 0 4px' }}>{r.motivo}</p>
          <p className="gs-mudo" style={{ margin: 0 }}>Pesa {brl(r.parcela)} por mês · fatura vai a {brl0(r.faturaDepois)} ({Math.round(r.usoDepois)}% do limite do banco).</p>
          {r.depois.map((v, i) => {
            const antes = r.antes[i];
            const m = mesCurto(somaMes(mesDe(hoje), i + 1));
            return <div key={m} className="gs-proj-linha"><span className="gs-mudo">{m}</span><Barra pct={Math.min(100, (v / Math.max(...r.depois, 1)) * 100)} rotulo={`Parcelas em ${m} depois da compra`} /><b className="gs-tab">{brl0(antes)} → {brl0(v)}{renda > 0 ? <small className="gs-mudo"> · {Math.round((v / renda) * 100)}%</small> : null}</b></div>;
          })}
        </div>
      ) : <p className="gs-nota">Digite o valor para ver o que muda nas próximas faturas.</p>}
    </Folha>
  );
}

function ImportarSheet({ aberta, c, onFechar }: { aberta: boolean; c: Cartao; onFechar: () => void }) {
  const [leitura, setLeitura] = useState<LeituraFatura | null>(null);
  const [colado, setColado] = useState('');
  const [pct, setPct] = useState(30);
  const [lendo, setLendo] = useState('');
  const hoje = useHoje();
  const arquivo = useRef<HTMLInputElement>(null);
  const analise = useMemo(() => (leitura && !leitura.erro ? analiseFatura(leitura.compras) : null), [leitura]);
  const fechar = () => { setLeitura(null); setColado(''); onFechar(); };
  const ler = (txt: string) => setLeitura(txt.trim() ? lerTextoDaFatura(txt, hoje) : null);
  const lerArquivo = async (f: File) => { setLendo('Lendo o arquivo…'); setLeitura(await lerArquivoFatura(f, hoje, setLendo)); setLendo(''); };
  const aplicar = () => {
    if (!leitura || leitura.erro) return;
    const antes = c;
    const r = aplicarFatura(c, leitura.compras, () => novoId('pc'));
    salvarCartao(r.cartao);
    toast(`Fatura atualizada: ${brl0(r.cartao.usado)}${r.adicionados + r.atualizados ? ` e ${r.adicionados + r.atualizados} parcelas` : ''}`, { acao: { rotulo: 'Desfazer', onClick: () => salvarCartao(antes) } });
    fechar();
  };
  return (
    <Folha aberta={aberta} onFechar={fechar} titulo="Importar fatura">
      {!leitura || leitura.erro ? (
        <>
          <p className="gs-sub" style={{ marginTop: 0 }}>Escolha a fatura: CSV, PDF ou uma foto/print. Tudo é lido no seu aparelho, sem enviar para ninguém; eu guardo só o total e as parcelas.</p>
          <input ref={arquivo} type="file" accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf,image/*" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void lerArquivo(f); ev.target.value = ''; }} />
          <button type="button" className="gs-btn cheio" disabled={Boolean(lendo)} onClick={() => arquivo.current?.click()}><Upload size={16} aria-hidden="true" /> Escolher arquivo</button>
          {lendo && <p className="gs-mudo" role="status" aria-live="polite">{lendo}</p>}
          <details className="gs-aprende"><summary>Ou copie e cole o texto da fatura</summary>
            <textarea className="gs-area" rows={5} value={colado} onChange={(ev) => { setColado(ev.target.value); ler(ev.target.value); }} aria-label="Texto da fatura" placeholder="03 NOV  Padaria  R$ 12,50" />
          </details>
          {leitura?.erro && <p role="alert" style={{ color: 'var(--danger)' }}>{leitura.erro}</p>}
          <p className="gs-nota">Foto e PDF funcionam sem internet de IA, mas a leitura pode errar: confira a lista antes de usar.</p>
        </>
      ) : (
        <>
          <p className="gs-sub" style={{ marginTop: 0 }}>Li <b>{leitura.compras.length} {leitura.compras.length === 1 ? 'compra' : 'compras'}</b> somando <b>{brl(totalFatura(leitura.compras))}</b>.{leitura.ignoradas ? ` Ignorei ${leitura.ignoradas} ${leitura.ignoradas === 1 ? 'linha' : 'linhas'} que não ${leitura.ignoradas === 1 ? 'era compra' : 'eram compras'} (pagamento, estorno).` : ''}</p>
          {analise && (
            <>
              <span className="gs-rotulo">Para onde foi</span>
              {analise.porCategoria.slice(0, 5).map((x) => { const I = iconeDe(x.categoria); return (
                <div className="gs-linha" key={x.categoria}><span className="gs-ic-cat" aria-hidden="true"><I size={18} /></span><div className="gs-corpo"><b>{x.categoria}</b><small>{Math.round(x.pct)}% da fatura</small></div><span className="gs-valor">{brl0(x.valor)}</span></div>
              ); })}
              {parceladasDaFatura(leitura.compras).length > 0 && <p className="gs-nota">Achei {parceladasDaFatura(leitura.compras).length} {parceladasDaFatura(leitura.compras).length === 1 ? 'compra parcelada que ainda vai cair' : 'compras parceladas que ainda vão cair'} nas próximas faturas. Elas entram na projeção. Já são {brl0(analise.parcelasDoMes)} desta fatura em parcelas antigas.</p>}
              {analise.cortavel > 0 && (
                <div className="gs-card" style={{ marginTop: 12 }}>
                  <span className="gs-rotulo">Onde dá para cortar</span>
                  <p style={{ margin: '4px 0' }}>{brl0(analise.cortavel)} em compras à vista de comida, lazer, compras e assinaturas.{analise.assinaturas.length > 0 ? ` Assinaturas: ${analise.assinaturas.map((a) => a.descricao).join(', ')}.` : ''}</p>
                  <label className="gs-campo"><span>E se eu cortar {pct}% disso por mês?</span><input type="range" min={10} max={100} step={10} value={pct} onChange={(ev) => setPct(Number(ev.target.value))} aria-label="Percentual de corte" /></label>
                  <p style={{ margin: 0 }}>Libera <b>{brl0((analise.cortavel * pct) / 100)}</b> por mês <span className="gs-mudo">(simulação, não é garantia)</span>.</p>
                  {analise.maiores.length > 0 && <p className="gs-nota">Maiores: {analise.maiores.map((m) => `${m.descricao} ${brl0(m.valor)}`).join(' · ')}.</p>}
                </div>
              )}
            </>
          )}
          <div className="gs-acoes">
            <button type="button" className="gs-btn cheio" onClick={aplicar}>Usar esta fatura</button>
            <button type="button" className="gs-btn link" onClick={() => setLeitura(null)}>Escolher outro arquivo</button>
          </div>
          <p className="gs-nota">"Usar" troca a fatura atual por {brl0(totalFatura(leitura.compras))}. Dá para desfazer logo depois.</p>
        </>
      )}
    </Folha>
  );
}

function OutroCartaoSheet({ valor, onFechar }: { valor: OutroCartao | 'novo' | null; onFechar: () => void }) {
  if (!valor) return null;
  return <Formulario key={valor === 'novo' ? 'novo' : valor.id} edit={valor === 'novo' ? null : valor} onFechar={onFechar} />;
}

function Formulario({ edit, onFechar }: { edit: OutroCartao | null; onFechar: () => void }) {
  const [nome, setNome] = useState(edit?.nome ?? '');
  const [limite, setLimite] = useState(edit?.limite ?? 0);
  const [usado, setUsado] = useState(edit?.usado ?? 0);
  const [dia, setDia] = useState<number | ''>(edit?.venceDia ?? '');
  const [tentou, setTentou] = useState(false);
  const diaOk = typeof dia === 'number' && dia >= 1 && dia <= 31;
  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTentou(true);
    if (!nome.trim() || !diaOk) return;
    if (!salvarOutroCartao({ id: edit?.id, nome, limite, usado, venceDia: dia as number })) return toast('Não consegui salvar (limite de 6 cartões extras).');
    toast(`${nome.trim()} ${edit ? 'atualizado' : 'adicionado'}`);
    onFechar();
  };
  return (
    <Folha aberta onFechar={onFechar} titulo={edit ? `Editar ${edit.nome}` : 'Outro cartão'}>
      <form onSubmit={salvar} noValidate>
        <Campo rotulo="Nome do cartão" valor={nome} onChange={setNome} placeholder="Ex.: Nubank, Inter, Loja" maxLength={30} autoFocus erro={tentou && !nome.trim() ? 'Dê um nome.' : undefined} />
        <CampoDinheiro rotulo="Fatura atual" valor={usado} onChange={setUsado} />
        <CampoDinheiro rotulo="Limite (opcional)" valor={limite} onChange={setLimite} />
        <CampoNumero rotulo="Vence todo dia…" valor={dia} onChange={setDia} min={1} max={31} placeholder="Ex.: 10" erro={tentou && !diaOk ? 'Digite um dia de 1 a 31.' : undefined} />
        <div className="gs-acoes">
          <button type="submit" className="gs-btn cheio">Salvar</button>
          {edit && <button type="button" className="gs-btn link" onClick={() => { const c = edit; removerOutroCartao(c.id); apagarComDesfazer(`${c.nome} removido`, () => restaurarOutroCartao(c)); onFechar(); }}>Remover</button>}
        </div>
      </form>
    </Folha>
  );
}
