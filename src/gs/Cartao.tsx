import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstado } from './store';
import { useHoje } from './useHoje';
import { comprarNoCartao, pagarFaturaCartao, salvarCartao, salvarDivida } from './acoes';
import { Agora, Barra, Campo, CampoDinheiro, CampoNumero, Dica, Folha, Heroi, MaisAjuda, Titulo } from './ui';
import { brl0, mesCurto, somaMes } from './datas';
import { acaoCartao, comprometidoTotal, proximaData, proximasFaturas, usoDoLimite } from './cartaoLogica';
import { toast } from '../components/ui/Toast';

/* ---------- Cartão de crédito: a fatura, o que já está combinado pra frente e o melhor dia de comprar ---------- */

export function CartaoTela() {
  const e = useEstado();
  const hoje = useHoje();
  const c = e.cartao;
  const [limite, setLimite] = useState(c?.limite ?? 0);
  const [usado, setUsado] = useState(c?.usado ?? 0);
  const [fecha, setFecha] = useState<number | ''>(c?.fechaDia ?? '');
  const [vence, setVence] = useState<number | ''>(c?.venceDia ?? '');
  const [editar, setEditar] = useState(!c);
  const [compra, setCompra] = useState(false);
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState(0);
  const [parcelas, setParcelas] = useState<number | ''>(1);
  const [rotativo, setRotativo] = useState(false);
  const [ficou, setFicou] = useState(0);
  const [jurosRot, setJurosRot] = useState<number | ''>(12);
  const ir = useNavigate();
  useEffect(() => {
    if (c) {
      setLimite(c.limite);
      setUsado(c.usado);
      setFecha(c.fechaDia);
      setVence(c.venceDia);
    }
  }, [c]);

  if (!c || editar)
    return (
      <>
        <Titulo titulo="Cartão de crédito" sub="Veja a fatura, o limite e as parcelas que já estão por vir." />
        <section className="gs-card destaque">
          <span className="gs-rotulo">{c ? 'Atualizar dados' : 'Comece por aqui'}</span>
          {!c && <p style={{ margin: '6px 0 10px' }}>Quatro dados do seu cartão, que estão no app do banco. Pode chutar o que não souber.</p>}
          <CampoDinheiro rotulo="Limite do cartão" valor={limite} onChange={setLimite} />
          <CampoDinheiro rotulo="Fatura atual (quanto já gastou)" valor={usado} onChange={setUsado} />
          <div className="gs-dois">
            <CampoNumero rotulo="Dia que fecha" valor={fecha} onChange={setFecha} min={1} max={31} />
            <CampoNumero rotulo="Dia que vence" valor={vence} onChange={setVence} min={1} max={31} />
          </div>
          <div className="gs-acoes">
            <button type="button" className="gs-btn" disabled={!(limite > 0) || typeof fecha !== 'number' || typeof vence !== 'number'} onClick={() => { salvarCartao({ ...(c ?? {}), limite, usado, fechaDia: fecha as number, venceDia: vence as number }); setEditar(false); toast('Cartão salvo'); }}>Salvar</button>
            {c && <button type="button" className="gs-btn sec" onClick={() => setEditar(false)}>Cancelar</button>}
          </div>
        </section>
      </>
    );

  const uso = usoDoLimite(c);
  const venc = proximaData(c.venceDia, hoje);
  const acao = acaoCartao(c, hoje);
  const futuras = proximasFaturas(c, 3);
  const maxFut = Math.max(...futuras, 1);
  const comprom = comprometidoTotal(c);
  const dia = Number(hoje.slice(8, 10));
  const cor = uso > 80 ? 'var(--danger)' : uso > 30 ? 'var(--gold-strong)' : 'var(--success)';

  return (
    <>
      <Titulo titulo="Cartão de crédito" sub="A fatura, o limite e as parcelas que já estão por vir." />
      <Heroi pct={uso} anel={`${Math.round(uso)}%`} anelSub="do limite" rotulo="Fatura atual" grande={brl0(c.usado)} sub={`Vence em ${venc.dias} ${venc.dias === 1 ? 'dia' : 'dias'} (dia ${c.venceDia}) · limite ${brl0(c.limite)}`} cor={cor} />
      <Agora tom={acao.tom} texto={acao.texto}>
        <div className="gs-acoes">
          <button type="button" className="gs-btn" onClick={() => setCompra(true)}>+ Compra no cartão</button>
          {acao.pagar && (
            <button
              type="button"
              className="gs-btn sec"
              onClick={() => {
                const antes = pagarFaturaCartao();
                toast(`Fatura de ${brl0(antes?.usado ?? 0)} paga`, { acao: { rotulo: 'Desfazer', onClick: () => antes && salvarCartao(antes) } });
              }}
            >
              Paguei a fatura
            </button>
          )}
          <button type="button" className="gs-btn link" onClick={() => setRotativo(true)}>Não consegui pagar tudo</button>
        </div>
      </Agora>

      {comprom > 0 && (
        <section className="gs-card">
          <span className="gs-rotulo">Já combinado pras próximas faturas</span>
          <p style={{ margin: '6px 0 0' }}>Parcelas que ainda vão cair: <b>{brl0(comprom)}</b>.</p>
          {futuras.map((v, i) => (
            v > 0 ? (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 10, alignItems: 'center', marginTop: 8, fontSize: 13 }}>
                <span className="gs-mudo">{mesCurto(somaMes(hoje.slice(0, 7), i + 1))}</span>
                <Barra pct={(v / maxFut) * 100} rotulo={`Parcelas em ${mesCurto(somaMes(hoje.slice(0, 7), i + 1))}`} />
                <b className="gs-tab">{brl0(v)}</b>
              </div>
            ) : null
          ))}
          {(c.parcelados ?? []).map((p) => <div className="gs-linha" key={p.id}><div className="gs-corpo"><b>{p.descricao}</b><small>{p.restantes} {p.restantes === 1 ? 'parcela' : 'parcelas'} de {brl0(p.parcela)}</small></div></div>)}
        </section>
      )}

      <MaisAjuda>
        <span className="gs-rotulo">Melhor dia de compra</span>
        <p style={{ margin: '6px 0 0' }}>Compre <b>logo depois de fechar a fatura (dia {c.fechaDia >= 31 ? 1 : c.fechaDia + 1})</b>: a compra só entra na fatura do mês seguinte e você ganha até 40 dias pra pagar.</p>
        <Dica>{dia <= c.fechaDia ? `Hoje é dia ${dia}: a fatura ainda não fechou. Compras de agora entram nesta fatura.` : `Hoje é dia ${dia}: a fatura já fechou. Compras de agora entram na próxima.`}</Dica>
        <span className="gs-rotulo" style={{ display: 'block', marginTop: 12 }}>Regras de ouro</span>
        {[
          <>Use no máximo <b>30% do limite</b> ({brl0(c.limite * 0.3)}).</>,
          <>Pague <b>sempre o total</b>. Pagar o mínimo joga o resto no rotativo, que passa de 400% ao ano.</>,
          <>Anote a compra parcelada <b>na hora</b>: as parcelas somem da vista e voltam como susto.</>,
        ].map((t, i) => <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0' }}><span className="gs-check" style={{ flex: 'none', fontWeight: 700 }}>{i + 1}</span><span>{t}</span></div>)}
        <button type="button" className="gs-btn sec" style={{ marginTop: 8 }} onClick={() => setEditar(true)}>Editar dados do cartão</button>
      </MaisAjuda>

      <Folha aberta={rotativo} onFechar={() => setRotativo(false)} titulo="O que ficou sem pagar">
        <p className="gs-sub" style={{ marginTop: 0 }}>Quando a fatura não é paga inteira, o que sobra vira rotativo e cresce rápido. Eu cadastro em Quitar dívidas e monto o caminho pra zerar.</p>
        <CampoDinheiro rotulo="Quanto ficou sem pagar?" valor={ficou} onChange={setFicou} grande />
        <CampoNumero rotulo="Juros do rotativo" sufixo="% ao mês" valor={jurosRot} onChange={setJurosRot} min={0} max={30} placeholder="Ex.: 12" />
        <div className="gs-acoes">
          <button type="button" className="gs-btn sec" onClick={() => setRotativo(false)}>Cancelar</button>
          <button
            type="button"
            className="gs-btn"
            disabled={!(ficou > 0) || typeof jurosRot !== 'number'}
            onClick={() => {
              if (salvarDivida({ nome: 'Cartão (rotativo)', saldo: ficou, jurosMensal: typeof jurosRot === 'number' ? jurosRot : 12, parcelaMinima: Math.max(50, Math.round((ficou * 0.15) / 10) * 10), venceDia: c.venceDia, tipo: 'rotativa' })) {
                toast('Cadastrado em Quitar dívidas', { acao: { rotulo: 'Ver', onClick: () => ir('/plano/dividas') } });
                setRotativo(false);
                setFicou(0);
              }
            }}
          >
            Cadastrar como dívida
          </button>
        </div>
      </Folha>

      <Folha aberta={compra} onFechar={() => setCompra(false)} titulo="Compra no cartão">
        <Campo rotulo="O que foi?" valor={desc} onChange={setDesc} placeholder="Ex.: tênis" maxLength={40} />
        <CampoDinheiro rotulo="Valor total" valor={valor} onChange={setValor} grande />
        <CampoNumero rotulo="Em quantas vezes?" valor={parcelas} onChange={setParcelas} min={1} max={24} />
        {typeof parcelas === 'number' && parcelas > 1 && valor > 0 && <p className="gs-sub">{parcelas}x de {brl0(valor / parcelas)}. Só a 1ª parcela entra na fatura de agora.</p>}
        <div className="gs-acoes">
          <button type="button" className="gs-btn sec" onClick={() => setCompra(false)}>Cancelar</button>
          <button
            type="button"
            className="gs-btn"
            disabled={!(valor > 0)}
            onClick={() => {
              const antes = e.cartao;
              if (comprarNoCartao({ descricao: desc, valor, parcelas: typeof parcelas === 'number' ? parcelas : 1 })) toast('Compra anotada', { acao: { rotulo: 'Desfazer', onClick: () => antes && salvarCartao(antes) } });
              setDesc('');
              setValor(0);
              setParcelas(1);
              setCompra(false);
            }}
          >
            Anotar
          </button>
        </div>
      </Folha>
    </>
  );
}
