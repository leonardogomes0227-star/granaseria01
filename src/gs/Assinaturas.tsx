import { useState } from 'react';
import { useEstado } from './store';
import { ANOS_PROJECAO, projecaoAnos, SUGESTOES_ASSINATURAS, TAXA_PADRAO_ASSINATURAS } from './ferramentas';
import { cancelarAssinatura, reativarAssinatura, removerAssinatura, salvarAssinatura } from './acoes';
import { brl, brl0 } from './datas';
import { Campo, CampoDinheiro, CampoNumero, Folha, Titulo } from './ui';
import { toast } from '../components/ui/Toast';
import type { Assinatura } from './tipos';

/* ---------- Gastos escondidos: o que você paga todo mês sem ver ---------- */

export function Assinaturas() {
  const e = useEstado();
  const [taxa, setTaxa] = useState<number | ''>(TAXA_PADRAO_ASSINATURAS);
  const [nova, setNova] = useState(false);
  const [editando, setEditando] = useState<Assinatura | null>(null);
  const ativas = e.assinaturas.filter((a) => a.ativa);
  const canceladas = e.assinaturas.filter((a) => !a.ativa);
  const total = ativas.reduce((t, a) => t + a.valor, 0);
  const economia = canceladas.reduce((t, a) => t + a.valor, 0);
  const proj = projecaoAnos(total, typeof taxa === 'number' ? taxa : 0);
  const marcada = (nome: string) => e.assinaturas.find((a) => !a.personalizada && a.nome === nome);
  return (
    <>
      <Titulo titulo="Gastos escondidos" sub="Marque o que você paga todo mês. Os valores são aproximados: edite pra ficar certo." />
      <section className="gs-card destaque">
        <div className="gs-tres">
          <div><span className="gs-mudo">Por mês</span><b className="gs-tab">{brl0(total)}</b></div>
          <div><span className="gs-mudo">Por ano</span><b className="gs-tab">{brl0(total * 12)}</b></div>
          <div><span className="gs-mudo">Já cortou /mês</span><b className="gs-tab">{brl0(economia)}</b></div>
        </div>
      </section>
      {total > 0 && (
        <section className="gs-card">
          <p className="gs-rotulo">Quanto isso vira</p>
          {proj.map((p) => (
            <div className="gs-linha" key={p.anos} style={{ minHeight: 48 }}>
              <div className="gs-corpo"><b>Em {p.anos} {p.anos === 1 ? 'ano' : 'anos'}</b><small>se fosse investido: {brl0(p.investido)}</small></div>
              <span className="gs-valor">{brl0(p.simples)}</span>
            </div>
          ))}
          <CampoNumero rotulo="Rendimento do investimento" sufixo="% ao mês" valor={taxa} onChange={setTaxa} min={0} max={5} passo={0.1} />
          <p className="gs-nota">Soma simples ({ANOS_PROJECAO.join(', ')} anos) e, ao lado, o valor se você investisse a mesma quantia todo mês. Estimativa com os seus números, não é recomendação de investimento.</p>
        </section>
      )}

      <h2 className="gs-h2">Marque as que você paga</h2>
      <div className="gs-card">
        {SUGESTOES_ASSINATURAS.map((s) => {
          const a = marcada(s.nome);
          return (
            <div className="gs-linha" key={s.nome}>
              <div className="gs-corpo"><b>{s.nome}</b><small>{a ? `${brl(a.valor)} por mês${a.ativa ? '' : ' · cortada'}` : `cerca de ${brl0(s.valor)}`}</small></div>
              {!a ? (
                <button type="button" className="gs-btn pequeno sec" onClick={() => salvarAssinatura({ nome: s.nome, valor: s.valor, ativa: true, personalizada: false })}>Eu pago</button>
              ) : (
                <button type="button" className="gs-btn link" onClick={() => setEditando(a)}>Editar</button>
              )}
            </div>
          );
        })}
      </div>

      {e.assinaturas.filter((a) => a.personalizada).length > 0 && (
        <>
          <h2 className="gs-h2">As suas</h2>
          <div className="gs-card">
            {e.assinaturas.filter((a) => a.personalizada).map((a) => (
              <div className="gs-linha" key={a.id}>
                <div className="gs-corpo"><b>{a.nome}</b><small>{brl(a.valor)} por mês{a.ativa ? '' : ' · cortada'}</small></div>
                <button type="button" className="gs-btn link" onClick={() => setEditando(a)}>Editar</button>
              </div>
            ))}
          </div>
        </>
      )}
      <button type="button" className="gs-btn sec cheio" onClick={() => setNova(true)}>+ Adicionar outra assinatura</button>

      {ativas.length > 0 && (
        <>
          <h2 className="gs-h2">Cortar</h2>
          <div className="gs-card">
            {ativas.map((a) => {
              const p = projecaoAnos(a.valor, typeof taxa === 'number' ? taxa : 0);
              return (
                <div className="gs-linha" key={a.id}>
                  <div className="gs-corpo"><b>{a.nome}</b><small>Cortando: {brl0(p[0].simples)} em 1 ano, {brl0(p[1].simples)} em 5, {brl0(p[2].simples)} em 10</small></div>
                  <button type="button" className="gs-btn pequeno" onClick={() => { cancelarAssinatura(a.id); toast(`${a.nome} cortada: ${brl0(a.valor)} a menos por mês`, { acao: { rotulo: 'Desfazer', onClick: () => reativarAssinatura(a.id) } }); }}>Cortar</button>
                </div>
              );
            })}
          </div>
        </>
      )}
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
