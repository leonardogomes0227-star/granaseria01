import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, Trash2 } from 'lucide-react';
import { useEstado } from './store';
import { brl0, mesDe } from './datas';
import { concluirPasso, desfazerGuardarNaMeta, desfazerPagamentoDivida, guardar, guardarNaMeta, mostrarPasso, ocultarPasso, pagarDivida, removerAporte, removerPasso } from './acoes';
import { abrirAdicionar } from './AdicionarMov';
import { BaixaSheet } from './BaixaSheet';
import { FormRenda } from './Onboarding';
import { Folha } from './ui';
import { LinhaDoTempo, Passo as PassoItem, type EstadoNo } from './base';
import { toast } from '../components/ui/Toast';
import type { Passo } from './passos';

/** Executa a ação de um passo: dar baixa, guardar, registrar pagamento… sempre com "Desfazer". Devolve as folhas que precisa abrir. */
export function useExecutarPasso(hoje: string): { executar: (p: Passo) => void; folhas: ReactNode } {
  const e = useEstado();
  const mes = mesDe(hoje);
  const [baixa, setBaixa] = useState<string | null>(null);
  const [renda, setRenda] = useState(false);
  const executar = (p: Passo) => {
    const { handler, refId, valor = 0 } = p.acao;
    if (handler === 'baixa' && refId) setBaixa(refId);
    else if (handler === 'renda') setRenda(true);
    else if (handler === 'adicionar') abrirAdicionar();
    else if (handler === 'guardar') {
      const id = guardar(valor, 'reserva');
      if (id) toast(`${brl0(valor)} guardados. Você se pagou primeiro.`, { acao: { rotulo: 'Desfazer', onClick: () => removerAporte(id) } });
    } else if (handler === 'pagar-divida' && refId) {
      if (pagarDivida(refId, valor, hoje)) toast(`Pagamento de ${brl0(valor)} registrado.`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerPagamentoDivida(refId, hoje, valor) } });
    } else if (handler === 'guardar-meta' && refId) {
      if (guardarNaMeta(refId, valor, hoje)) toast(`${brl0(valor)} guardados na meta.`, { acao: { rotulo: 'Desfazer', onClick: () => desfazerGuardarNaMeta(refId, hoje, valor) } });
    } else if (handler === 'concluir' && refId) {
      concluirPasso(refId);
      toast('Passo feito.', { acao: { rotulo: 'Desfazer', onClick: () => concluirPasso(refId, false) } });
    }
  };
  const folhas = (
    <>
      <BaixaSheet gasto={e.gastosFixos.find((g) => g.id === baixa) ?? null} mes={mes} onFechar={() => setBaixa(null)} />
      <Folha aberta={renda} onFechar={() => setRenda(false)} titulo="Sua renda por mês"><FormRenda onFeito={() => setRenda(false)} rotuloBotao="Salvar" concluir={false} /></Folha>
    </>
  );
  return { executar, folhas };
}

const ESTADO: Record<Passo['status'], EstadoNo> = { atual: 'atual', pendente: 'pendente', feito: 'feito', segurado: 'segurado', continuo: 'continuo', oculto: 'futuro' };

/** O botão de ação de um passo (rota ou ação direta). */
export function BotaoDoPasso({ p, executar, principal }: { p: Passo; executar: (p: Passo) => void; principal?: boolean }) {
  const cls = principal ? 'gs-btn' : 'gs-btn sec pequeno';
  return p.acao.rota ? <Link to={p.acao.rota} className={cls}>{p.acao.rotulo}</Link> : <button type="button" className={cls} onClick={() => executar(p)}>{p.acao.rotulo}</button>;
}

/** Os passos do mês em linha do tempo, com o passo atual em destaque. `brilhar` = id do passo que acabou de ser procurado. */
export function ListaDePassos({ passos, executar, brilhar, hoje }: { passos: Passo[]; executar: (p: Passo) => void; brilhar?: string | null; hoje: string }) {
  const mes = mesDe(hoje);
  let n = 0;
  return (
    <LinhaDoTempo rotulo="Seus passos deste mês">
      {passos.map((p) => {
        if (p.status !== 'continuo') n++;
        const atual = p.status === 'atual';
        const idManual = p.manual ? p.id.replace(/^plano:/, '') : null;
        return (
          <PassoItem key={p.id} id={`passo-${p.id}`} n={n} estado={ESTADO[p.status]} titulo={p.titulo} detalhe={p.detalhe} destaque={atual}>
            {p.status !== 'feito' && (
              <div className={`gs-acoes${brilhar === p.id ? ' cm-brilho' : ''}`} style={{ borderRadius: 16, alignItems: 'center' }}>
                {p.status === 'oculto' ? (
                  <button type="button" className="gs-btn sec pequeno" onClick={() => mostrarPasso(p.id)}>Mostrar de novo</button>
                ) : (
                  <>
                    <BotaoDoPasso p={p} executar={executar} principal={atual} />
                    {idManual && p.acao.handler !== 'concluir' && <button type="button" className="gs-btn link" onClick={() => concluirPasso(idManual)}>Já fiz</button>}
                    {idManual ? (
                      <button type="button" className="gs-icone-btn" aria-label={`Apagar o passo: ${p.titulo}`} onClick={() => { removerPasso(idManual); toast('Passo apagado.'); }}><Trash2 size={18} aria-hidden="true" /></button>
                    ) : p.status !== 'continuo' && (
                      <button type="button" className="gs-icone-btn" aria-label={`Esconder este mês: ${p.titulo}`} title="Esconder este mês" onClick={() => { ocultarPasso(p.id, mes); toast('Passo escondido até o mês que vem.', { acao: { rotulo: 'Desfazer', onClick: () => mostrarPasso(p.id) } }); }}><EyeOff size={18} aria-hidden="true" /></button>
                    )}
                  </>
                )}
              </div>
            )}
          </PassoItem>
        );
      })}
    </LinhaDoTempo>
  );
}
