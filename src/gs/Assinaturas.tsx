import { useState } from 'react';
import { RespostaFerramenta } from './RespostaFerramenta';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { projecaoAnos, SUGESTOES_ASSINATURAS, TAXA_PADRAO_ASSINATURAS } from './ferramentas';
import { cancelarAssinatura, marcarUsoAssinatura, reativarAssinatura, removerAssinatura, salvarAssinatura } from './acoes';
import { brl, brl0, mesDe } from './datas';
import { Agora, Barra, Campo, CampoDinheiro, CampoNumero, Conquistas, Folha, Heroi, MaisAjuda, Titulo } from './ui';
import { ImpactoNoCaminho } from './Impacto';
import { toast } from '../components/ui/Toast';
import { acaoAssinaturas, conquistasAssinaturas, resumoAssinaturas, revisada } from './assinaturasLogica';
import type { Assinatura } from './tipos';
import { CalendarClock, Percent, Repeat, Scissors } from 'lucide-react';
import { FaixaKpis, GraficoBarras } from './PainelUI';

/* ---------- Gastos escondidos: o que você paga todo mês, o que usa de verdade e quanto sobra se cortar ---------- */

const USOS = [['sim', 'Usei'], ['pouco', 'Pouco'], ['nao', 'Não uso']] as const;

export function Assinaturas() {
  const e = useEstado();
  const mes = mesDe(useHoje());
  const [taxa, setTaxa] = useState<number | ''>(TAXA_PADRAO_ASSINATURAS);
  const [nova, setNova] = useState(false);
  const [editando, setEditando] = useState<Assinatura | null>(null);
  const ativas = e.assinaturas.filter((a) => a.ativa);
  const r = resumoAssinaturas(e.assinaturas, mes);
  const acao = acaoAssinaturas(e.assinaturas, mes);
  const proj = projecaoAnos(r.total, typeof taxa === 'number' ? taxa : 0);
  const marcada = (nome: string) => e.assinaturas.find((a) => !a.personalizada && a.nome === nome);
  const cortar = (a: Assinatura) => { cancelarAssinatura(a.id); toast(`${a.nome} cortada: ${brl0(a.valor)} a menos por mês`, { acao: { rotulo: 'Desfazer', onClick: () => reativarAssinatura(a.id) } }); };
  return (
    <>
      <Titulo titulo="Gastos escondidos" sub="O que você paga todo mês sem ver." />
      <RespostaFerramenta id="assinaturas" />
      <Heroi pct={r.pctRevisado} anel={`${Math.round(r.pctRevisado)}%`} anelSub="revisado" rotulo="Você paga por mês" grande={brl0(r.total)} sub={`${brl0(r.anual)} por ano${r.cortado > 0 ? ` · já cortou ${brl0(r.cortado)}/mês` : ''}`} cor="var(--success)" />
      <Agora tom={acao.tom} texto={acao.texto}>
        {acao.alvo && acao.tipo === 'revisar' && (
          <div className="gs-chips" role="group" aria-label={`Você usou ${acao.alvo.nome}?`} style={{ marginTop: 12 }}>
            {USOS.map(([id, nome]) => <button key={id} type="button" className="gs-chip" onClick={() => marcarUsoAssinatura(acao.alvo!.id, id)}>{nome}</button>)}
          </div>
        )}
        {acao.alvo && acao.tipo === 'cortar' && (
          <div className="gs-acoes">
            <button type="button" className="gs-btn" onClick={() => cortar(acao.alvo!)}>Cortar {acao.alvo.nome}</button>
            <button type="button" className="gs-btn sec" onClick={() => marcarUsoAssinatura(acao.alvo!.id, 'pouco')}>Vou manter</button>
          </div>
        )}
        {acao.tipo === 'vazio' && <button type="button" className="gs-btn" style={{ marginTop: 12 }} onClick={() => setNova(true)}>+ Adicionar assinatura</button>}
      </Agora>
      {acao.alvo && acao.tipo === 'cortar' && <ImpactoNoCaminho mudanca={{ tipo: 'corte', porMes: acao.alvo.valor }} passo={{ titulo: `Cancelar ${acao.alvo.nome}`, detalhe: `${brl0(acao.alvo.valor)} a menos por mês (${brl0(acao.alvo.valor * 12)} por ano).`, rota: '/plano/assinaturas', origem: 'assinaturas' }} />}
      {ativas.length > 0 && <FaixaKpis itens={[
        { rotulo: 'Por mês', valor: r.total, icone: Repeat, tom: r.total > 0 ? 'aviso' : '', nota: `${ativas.length} ${ativas.length === 1 ? 'assinatura' : 'assinaturas'}` },
        { rotulo: 'Por ano', valor: r.anual, icone: CalendarClock, nota: 'se nada mudar' },
        { rotulo: 'Já cortado', valor: r.cortado, icone: Scissors, tom: r.cortado > 0 ? 'ok' : '', nota: 'a menos por mês' },
        { rotulo: 'Revisado', valor: Math.round(r.pctRevisado), formato: 'pct', icone: Percent, tom: r.pctRevisado >= 100 ? 'ok' : '', nota: 'você disse se usa' },
      ]} />}
      {ativas.length > 0 && <GraficoBarras titulo="Quanto cada uma custa" sub="por mês" dados={ativas.map((a) => ({ rotulo: a.nome, valor: a.valor, tom: a.uso === 'nao' ? 'perigo' : a.uso === 'pouco' ? 'aviso' : '', legenda: `${a.nome}${a.uso === 'nao' ? ' · não usa' : a.uso === 'pouco' ? ' · usa pouco' : ''}` }) as const)} />}
      <Conquistas lista={conquistasAssinaturas(e.assinaturas, mes)} />

      {ativas.length > 0 && (
        <section className="gs-card">
          <span className="gs-rotulo">Suas assinaturas</span>
          {ativas.map((a) => (
            <div key={a.id} className="gs-linha" style={{ flexWrap: 'wrap' }}>
              <div className="gs-corpo">
                <b>{a.nome}</b>
                <small>{brl(a.valor)} por mês{revisada(a, mes) ? (a.uso === 'sim' ? ' · você usa' : a.uso === 'pouco' ? ' · usa pouco' : ' · não usa') : ''}</small>
              </div>
              <button type="button" className="gs-btn link" onClick={() => setEditando(a)}>Editar</button>
              <div className="gs-chips" style={{ flexBasis: '100%', margin: '4px 0 0' }} role="group" aria-label={`Uso de ${a.nome}`}>
                {USOS.map(([id, nome]) => <button key={id} type="button" className={`gs-chip ${revisada(a, mes) && a.uso === id ? 'on' : ''}`} aria-pressed={revisada(a, mes) && a.uso === id} onClick={() => marcarUsoAssinatura(a.id, id)}>{nome}</button>)}
                <button type="button" className="gs-chip" onClick={() => cortar(a)}>Cortar</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <details className="gs-card" open={r.total === 0} style={{ padding: '4px 20px' }}>
        <summary style={{ minHeight: 52, display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>{r.total > 0 ? 'Marcar outras que você paga' : 'Marque as que você paga'}</summary>
        {SUGESTOES_ASSINATURAS.map((sug) => {
          const a = marcada(sug.nome);
          return (
            <div className="gs-linha" key={sug.nome}>
              <div className="gs-corpo"><b>{sug.nome}</b><small>{a ? `${brl(a.valor)} por mês${a.ativa ? '' : ' · cortada'}` : `cerca de ${brl0(sug.valor)}`}</small></div>
              {!a ? <button type="button" className="gs-btn pequeno sec" onClick={() => salvarAssinatura({ nome: sug.nome, valor: sug.valor, ativa: true, personalizada: false })}>Eu pago</button> : null}
            </div>
          );
        })}
        <button type="button" className="gs-btn sec cheio" style={{ marginTop: 10 }} onClick={() => setNova(true)}>+ Adicionar outra</button>
      </details>

      <MaisAjuda>
        {r.total > 0 && (
          <>
            <span className="gs-rotulo">Quanto isso vira</span>
            {proj.map((p) => {
              const mx = Math.max(proj[proj.length - 1].simples, proj[proj.length - 1].investido, 1);
              return (
                <div key={p.anos} style={{ marginTop: 12 }}>
                  <b>Em {p.anos} {p.anos === 1 ? 'ano' : 'anos'}</b>
                  {([['Gasto', p.simples, ''], ['Investido', p.investido, 'ok']] as const).map(([nome, v, tom]) => (
                    <div key={nome} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 10, alignItems: 'center', marginTop: 6, fontSize: 13 }}>
                      <span className="gs-mudo">{nome}</span>
                      <Barra pct={(v / mx) * 100} tom={tom} rotulo={`${nome} em ${p.anos} anos`} />
                      <b className="gs-tab">{brl0(v)}</b>
                    </div>
                  ))}
                </div>
              );
            })}
            <div style={{ marginTop: 12 }}><CampoNumero rotulo="Rendimento do investimento" sufixo="% ao mês" valor={taxa} onChange={setTaxa} min={0} max={5} passo={0.1} /></div>
            <p className="gs-nota" style={{ marginTop: -6 }}>Estimativa com os seus números. Não é recomendação de investimento. Rentabilidade passada não garante resultado futuro.</p>
          </>
        )}
        <p className="gs-sub">R$ 40 por mês parece pouco. Em 10 anos são R$ 4.800 e, investidos, viram bem mais. Assinatura é o gasto que se repete sozinho: você só percebe quando olha o total.</p>
        {e.assinaturas.filter((a) => !a.ativa).length > 0 && (
          <>
            <span className="gs-rotulo">Cortadas</span>
            {e.assinaturas.filter((a) => !a.ativa).map((a) => (
              <div className="gs-linha" key={a.id}><div className="gs-corpo"><b>{a.nome}</b><small>{brl(a.valor)} por mês</small></div><button type="button" className="gs-btn link" onClick={() => reativarAssinatura(a.id)}>Reativar</button></div>
            ))}
          </>
        )}
      </MaisAjuda>
      <FormAssinatura aberta={nova || Boolean(editando)} valor={editando} onFechar={() => { setNova(false); setEditando(null); }} />
    </>
  );
}

function FormAssinatura({ aberta, valor, onFechar }: { aberta: boolean; valor: Assinatura | null; onFechar: () => void }) {
  const [nome, setNome] = useState(valor?.nome ?? '');
  const [v, setV] = useState(valor?.valor ?? 0);
  const [chave, setChave] = useState('');
  const k = valor?.id ?? 'nova';
  if (aberta && chave !== k) {
    setChave(k);
    setNome(valor?.nome ?? '');
    setV(valor?.valor ?? 0);
  }
  if (!aberta && chave) setChave('');
  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={valor ? 'Editar assinatura' : 'Nova assinatura'}>
      <Campo rotulo="Nome" valor={nome} onChange={setNome} maxLength={60} placeholder="Ex.: Revista" />
      <CampoDinheiro rotulo="Valor por mês" valor={v} onChange={setV} />
      <div className="gs-acoes">
        {valor && (
          <button type="button" className="gs-btn link" onClick={() => { const a = valor; removerAssinatura(a.id); toast(`${a.nome} removida`, { acao: { rotulo: 'Desfazer', onClick: () => salvarAssinatura({ ...a, id: undefined }) } }); onFechar(); }}>Remover</button>
        )}
        <button type="button" className="gs-btn sec" onClick={onFechar}>Cancelar</button>
        <button type="button" className="gs-btn" onClick={() => { if (salvarAssinatura({ id: valor?.id, nome, valor: v, ativa: valor?.ativa ?? true, personalizada: valor?.personalizada ?? true, canceladaEm: valor?.canceladaEm })) onFechar(); }}>Salvar</button>
      </div>
    </Folha>
  );
}
