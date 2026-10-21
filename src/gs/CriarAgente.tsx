import { useEffect, useState } from 'react';
import { Folha, Campo, CampoDinheiro, CampoNumero } from './ui';
import { atualizarAgente, criarAgente } from './acoes';
import { useEstado } from './store';
import { METODOS, planoDaMeta, PCT_PADRAO, ROTULOS_METODO, dividirMetodo, type Metodo } from './ferramentas';
import { brl0, hoje as hojeSP, somaDias } from './datas';
import { toast } from '../components/ui/Toast';
import type { AgenteCustom, TipoAgente } from './tipos';

/* ---------- Criar meu agente: 4 passos curtos ---------- */

const TIPOS: { id: TipoAgente; nome: string; texto: string }[] = [
  { id: 'juntar', nome: 'Juntar dinheiro', texto: 'Uma meta com valor e prazo.' },
  { id: 'lembrar', nome: 'Lembrar de algo', texto: 'Um aviso que você escolhe.' },
  { id: 'metodo', nome: 'Seguir um método', texto: '50/30/20, envelopes, 52 semanas…' },
  { id: 'personalizado', nome: 'Personalizado', texto: 'Um objetivo seu, com checklist.' },
];
const AVATARES = ['★', '◆', '●', '▲', '✦', '❖', '☀', '♥'];
const CORES = ['var(--gold-strong)', 'var(--success)', 'var(--danger)', 'var(--ink)', 'var(--ink-muted)', 'var(--gold)'];

export function CriarAgente({ aberta, onFechar, editar }: { aberta: boolean; onFechar: () => void; editar?: AgenteCustom }) {
  const e = useEstado();
  const [passo, setPasso] = useState(1);
  const [tipo, setTipo] = useState<TipoAgente>('juntar');
  const [nome, setNome] = useState('');
  const [avatar, setAvatar] = useState(AVATARES[0]);
  const [cor, setCor] = useState(CORES[0]);
  const [tentou, setTentou] = useState(false);
  // juntar
  const [meta, setMeta] = useState('');
  const [alvo, setAlvo] = useState(0);
  const [ja, setJa] = useState(0);
  const [prazo, setPrazo] = useState(somaDias(hojeSP(), 180));
  // lembrar
  const [desc, setDesc] = useState('');
  const [data, setData] = useState(hojeSP());
  const [hora, setHora] = useState('09:00');
  const [repete, setRepete] = useState<'unica' | 'diaria' | 'semanal' | 'mensal'>('unica');
  const [antecedencia, setAntecedencia] = useState<number | ''>(0);
  // método
  const [metodo, setMetodo] = useState<Metodo>('pague-se-primeiro');
  const [rendaBase, setRendaBase] = useState(e.config.renda);
  const [pcts, setPcts] = useState<number[]>(PCT_PADRAO['pague-se-primeiro']);
  const [base52, setBase52] = useState<number | ''>(1);
  // personalizado
  const [objetivo, setObjetivo] = useState('');
  const [checklist, setChecklist] = useState('');

  useEffect(() => {
    if (!aberta) return;
    setTentou(false);
    setPasso(editar ? 3 : 1);
    if (editar) {
      const c = editar.config;
      setTipo(editar.tipo);
      setNome(editar.nome);
      setAvatar(editar.avatar);
      setCor(editar.cor);
      setMeta(String(c.meta ?? ''));
      setAlvo(Number(c.alvo ?? 0));
      setJa(Number(c.jaGuardado ?? 0));
      setPrazo(String(c.prazo ?? prazo));
      setDesc(String(c.descricao ?? ''));
      setData(String(c.data ?? data));
      setHora(String(c.hora ?? '09:00'));
      setRepete((String(c.repete ?? 'unica') as typeof repete));
      setAntecedencia(Number(c.antecedencia ?? 0));
      setMetodo((String(c.metodo ?? 'pague-se-primeiro') as Metodo));
      setRendaBase(Number(c.renda ?? e.config.renda));
      setPcts(Array.isArray(c.pcts) ? (c.pcts as unknown as number[]) : PCT_PADRAO[(String(c.metodo ?? 'pague-se-primeiro') as Metodo)]);
      setBase52(Number(c.base ?? 1));
      setObjetivo(String(c.objetivo ?? ''));
      setChecklist(Array.isArray(c.checklist) ? (c.checklist as string[]).join('\n') : '');
    } else {
      setTipo('juntar');
      setNome('');
      setMeta('');
      setAlvo(0);
      setJa(0);
      setDesc('');
      setObjetivo('');
      setChecklist('');
      setRendaBase(e.config.renda);
    }
  }, [aberta]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocaMetodo = (m: Metodo) => {
    setMetodo(m);
    setPcts(PCT_PADRAO[m]);
  };

  const validoConfig = () => {
    if (tipo === 'juntar') return meta.trim() && alvo > 0 && prazo;
    if (tipo === 'lembrar') return desc.trim() && data;
    if (tipo === 'metodo') return metodo === '52-semanas' ? typeof base52 === 'number' && base52 > 0 : rendaBase > 0 && pcts.reduce((t, x) => t + x, 0) === 100;
    return objetivo.trim();
  };
  const config = (): AgenteCustom['config'] => {
    if (tipo === 'juntar') return { meta: meta.trim(), alvo, jaGuardado: ja, prazo };
    if (tipo === 'lembrar') return { descricao: desc.trim(), data, hora, repete, antecedencia: typeof antecedencia === 'number' ? antecedencia : 0 };
    if (tipo === 'metodo') return metodo === '52-semanas' ? { metodo, base: typeof base52 === 'number' ? base52 : 1, inicio: hojeSP() } : { metodo, renda: rendaBase, pcts: pcts as unknown as string[] };
    return { objetivo: objetivo.trim(), checklist: checklist.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20) };
  };
  const proximo = () => {
    setTentou(true);
    if (passo === 2 && !nome.trim()) return;
    if (passo === 3 && !validoConfig()) return;
    setTentou(false);
    setPasso((p) => Math.min(4, p + 1));
  };
  const salvar = () => {
    if (editar) {
      atualizarAgente(editar.id, (a) => ({ ...a, nome: nome.trim(), avatar, cor, tipo, config: config() }));
      toast('Agente atualizado');
    } else {
      const id = criarAgente({ tipo, nome: nome.trim().slice(0, 40), avatar, cor, config: config() });
      if (!id) return void toast('Você já tem 10 agentes. Exclua um pra criar outro.');
      toast(`${nome.trim()} criado`);
    }
    onFechar();
  };

  const planoMeta = tipo === 'juntar' && alvo > 0 ? planoDaMeta({ alvo, jaGuardado: ja, prazo, hoje: hojeSP() }) : null;
  const partes = tipo === 'metodo' && metodo !== '52-semanas' ? dividirMetodo(rendaBase, pcts) : [];

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo={editar ? 'Editar agente' : `Criar meu agente · ${passo} de 4`}>
      <div className="gs-passos">{[1, 2, 3, 4].map((n) => <i key={n} className={n <= passo ? 'on' : ''} />)}</div>
      {passo === 1 && (
        <div className="gs-lista-acoes">
          {TIPOS.map((t) => (
            <button key={t.id} type="button" className={`gs-acao ${tipo === t.id ? 'urgente' : ''}`} style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit' }} aria-pressed={tipo === t.id} onClick={() => setTipo(t.id)}>
              <p><b>{t.nome}</b><br /><span className="gs-mudo">{t.texto}</span></p>
            </button>
          ))}
        </div>
      )}
      {passo === 2 && (
        <>
          <Campo rotulo="Nome do agente" valor={nome} onChange={setNome} maxLength={40} placeholder="Ex.: Viagem" erro={tentou && !nome.trim() ? 'Dê um nome.' : undefined} autoFocus />
          <p className="gs-rotulo">Avatar</p>
          <div className="gs-chips">{AVATARES.map((a) => <button key={a} type="button" className={`gs-chip ${avatar === a ? 'on' : ''}`} aria-label={`Avatar ${a}`} aria-pressed={avatar === a} onClick={() => setAvatar(a)}>{a}</button>)}</div>
          <p className="gs-rotulo">Cor</p>
          <div className="gs-chips">{CORES.map((c) => <button key={c} type="button" className={`gs-chip ${cor === c ? 'on' : ''}`} aria-label="Cor" aria-pressed={cor === c} onClick={() => setCor(c)}><i style={{ width: 18, height: 18, borderRadius: '50%', background: c, display: 'inline-block' }} /></button>)}</div>
        </>
      )}
      {passo === 3 && (
        <>
          {tipo === 'juntar' && (
            <>
              <Campo rotulo="Nome da meta" valor={meta} onChange={setMeta} placeholder="Ex.: Viagem" maxLength={60} erro={tentou && !meta.trim() ? 'Dê um nome.' : undefined} />
              <div className="gs-dois"><CampoDinheiro rotulo="Valor-alvo" valor={alvo} onChange={setAlvo} /><CampoDinheiro rotulo="Já guardado" valor={ja} onChange={setJa} /></div>
              <Campo rotulo="Prazo" valor={prazo} onChange={setPrazo} tipo="date" />
              {planoMeta && <p className="gs-banner">{planoMeta.metaBatida ? 'Meta já batida.' : planoMeta.prazoVencido ? 'Esse prazo já passou. Escolha uma data futura.' : `Guarde ${brl0(planoMeta.porSemana)} por semana (${brl0(planoMeta.porMes)} por mês).`}</p>}
            </>
          )}
          {tipo === 'lembrar' && (
            <>
              <Campo rotulo="Do que lembrar?" valor={desc} onChange={setDesc} maxLength={80} erro={tentou && !desc.trim() ? 'Escreva o lembrete.' : undefined} />
              <div className="gs-dois"><Campo rotulo="Data" valor={data} onChange={setData} tipo="date" /><Campo rotulo="Hora" valor={hora} onChange={setHora} tipo="time" /></div>
              <div className="gs-chips" role="group" aria-label="Repetição">{(['unica', 'diaria', 'semanal', 'mensal'] as const).map((r) => <button key={r} type="button" className={`gs-chip ${repete === r ? 'on' : ''}`} aria-pressed={repete === r} onClick={() => setRepete(r)}>{{ unica: 'Uma vez', diaria: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' }[r]}</button>)}</div>
              <CampoNumero rotulo="Avisar dias antes" valor={antecedencia} onChange={setAntecedencia} min={0} max={30} />
            </>
          )}
          {tipo === 'metodo' && (
            <>
              <div className="gs-lista-acoes" style={{ marginBottom: 14 }}>{METODOS.map((m) => <button key={m.id} type="button" className={`gs-acao ${metodo === m.id ? 'urgente' : ''}`} style={{ textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit' }} aria-pressed={metodo === m.id} onClick={() => trocaMetodo(m.id)}><p><b>{m.nome}</b><br /><span className="gs-mudo">{m.descricao}</span></p></button>)}</div>
              {metodo === '52-semanas' ? (
                <CampoNumero rotulo="Valor base da semana 1" sufixo="R$" valor={base52} onChange={setBase52} min={0.5} max={1000} />
              ) : (
                <>
                  <CampoDinheiro rotulo="Renda base" valor={rendaBase} onChange={setRendaBase} />
                  {ROTULOS_METODO[metodo].map((r, i) => (
                    <div className="gs-dois" key={r}>
                      <CampoNumero rotulo={r} sufixo="%" valor={pcts[i]} onChange={(n) => setPcts((p) => p.map((x, k) => (k === i ? (typeof n === 'number' ? n : 0) : x)))} min={0} max={100} />
                      <div className="gs-campo"><span>Em reais</span><b className="gs-medio" style={{ fontSize: 20 }}>{brl0(partes[i] ?? 0)}</b></div>
                    </div>
                  ))}
                  {pcts.reduce((t, x) => t + x, 0) !== 100 && <p className="gs-erro" role="alert" style={{ color: 'var(--danger)' }}>Os percentuais somam {pcts.reduce((t, x) => t + x, 0)}%. Precisam fechar 100%.</p>}
                </>
              )}
            </>
          )}
          {tipo === 'personalizado' && (
            <>
              <Campo rotulo="Qual é o seu objetivo?" valor={objetivo} onChange={setObjetivo} maxLength={120} erro={tentou && !objetivo.trim() ? 'Escreva o objetivo.' : undefined} />
              <label className="gs-campo"><span>Checklist (um item por linha, opcional)</span><textarea value={checklist} onChange={(ev) => setChecklist(ev.target.value)} placeholder={'Separar contas\nArquivar papéis'} /></label>
            </>
          )}
          {tentou && !validoConfig() && <p className="gs-erro" role="alert" style={{ color: 'var(--danger)' }}>Preencha os campos pra continuar.</p>}
        </>
      )}
      {passo === 4 && (
        <div className="gs-card ivory">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span className="gs-avatar" style={{ color: cor, background: 'var(--bg-2)' }}>{avatar}</span><div><b className="gs-medio" style={{ fontSize: 20 }}>{nome}</b><br /><span className="gs-mudo">{TIPOS.find((t) => t.id === tipo)?.nome}</span></div></div>
          <p className="gs-sub" style={{ margin: '12px 0 0' }}>
            {tipo === 'juntar' && `Meta: ${meta} · ${brl0(alvo)} até o prazo escolhido.`}
            {tipo === 'lembrar' && `${desc} · ${data}${hora ? ` às ${hora}` : ''}`}
            {tipo === 'metodo' && METODOS.find((m) => m.id === metodo)?.nome}
            {tipo === 'personalizado' && objetivo}
          </p>
        </div>
      )}
      <div className="gs-acoes">
        <button type="button" className="gs-btn sec" onClick={() => (passo === 1 || (editar && passo === 3) ? onFechar() : setPasso((p) => p - 1))}>{passo === 1 || (editar && passo === 3) ? 'Cancelar' : 'Voltar'}</button>
        {passo < 4 ? <button type="button" className="gs-btn" onClick={proximo}>Continuar</button> : <button type="button" className="gs-btn" onClick={salvar}>{editar ? 'Salvar' : 'Criar agente'}</button>}
      </div>
    </Folha>
  );
}
