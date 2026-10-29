import { useEstado } from './store';
import { brl0, mesCurto } from './datas';
import { ordenar, paraSim, saldoAtual, simular } from './dividas';
import { Folha } from './ui';
import { toast } from '../components/ui/Toast';
import { imagemQuitou } from './imagemQuitou';

/* ---------- Quando uma dívida zera: confete, o que mudou e um botão pra contar pra alguém ---------- */

export interface Quitada {
  nome: string;
  valor: number; // quanto ela devia
  libera: number; // quanto por mês ela deixa livre pra próxima
  desfazer: () => void; // foi sem querer: tira o pagamento
}

const CONFETES = Array.from({ length: 26 }, (_, i) => ({ esq: (i * 37) % 100, atraso: (i % 7) * 0.12, cor: ['#D8B060', '#B8860B', '#4F7A4A', '#A34A3A'][i % 4], gira: (i * 53) % 360 }));

export function FestaQuitou({ quitada, onFechar }: { quitada: Quitada | null; onFechar: () => void }) {
  const e = useEstado();
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0);
  const sim = paraSim(e.dividas);
  const estrategia = e.planoDividas?.estrategia ?? 'maior-juro';
  const proxima = ordenar(sim, estrategia)[0];
  const fim = abertas.length > 0 && e.planoDividas ? simular(sim, e.planoDividas.pagamentoMensal, estrategia).dataFinal : null;
  const frase = quitada ? `Quitei ${quitada.nome} (${brl0(quitada.valor)}) com o Grana Séria${abertas.length ? `. ${abertas.length === 1 ? 'Falta' : 'Faltam'} ${abertas.length} ${abertas.length === 1 ? 'dívida' : 'dívidas'}.` : '. Estou livre das dívidas!'}` : '';
  const contar = () => {
    if (navigator.share) void navigator.share({ text: frase }).catch(() => undefined);
    else void navigator.clipboard?.writeText(frase).then(() => toast('Texto copiado'), () => toast('Não consegui copiar.'));
  };
  return (
    <Folha aberta={Boolean(quitada)} onFechar={onFechar} titulo="Parabéns">
      {quitada && (
        <div className="gs-festa">
          <div className="gs-confete" aria-hidden="true">
            {CONFETES.map((c, i) => <i key={i} style={{ left: `${c.esq}%`, animationDelay: `${c.atraso}s`, background: c.cor, rotate: `${c.gira}deg` }} />)}
          </div>
          <p className="gs-rotulo">Dívida quitada</p>
          <p className="gs-grande" style={{ margin: '4px 0 8px' }}>Zerou: {quitada.nome}</p>
          <p style={{ margin: '0 0 8px' }}>Você tirou {brl0(quitada.valor)} da sua lista.</p>
          {proxima && (
            <p style={{ margin: '0 0 8px' }}>
              {quitada.libera > 0 ? `Os ${brl0(quitada.libera)} por mês que iam pra ela agora vão pra ` : 'O seu dinheiro agora vai pra '}
              <b>{proxima.nome}</b>.{fim ? ` Você fica livre em ${mesCurto(fim)}.` : ''}
            </p>
          )}
          {!proxima && <p style={{ margin: '0 0 8px' }}>Foi a última. Agora guarde o mesmo valor todo mês, começando pela reserva de emergência.</p>}
          <div className="gs-acoes">
            <button type="button" className="gs-btn sec" onClick={() => void imagemQuitou({ nome: quitada.nome, valor: brl0(quitada.valor), faltam: abertas.length, siteUrl: 'granaseria.com.br' }).catch(contar)}>Postar no story</button>
            <button type="button" className="gs-btn sec" onClick={contar}>Mandar por texto</button>
            <button type="button" className="gs-btn" onClick={onFechar}>Continuar</button>
          </div>
          <button type="button" className="gs-btn link" onClick={() => { quitada.desfazer(); onFechar(); toast('Pagamento desfeito'); }}>Foi sem querer? Desfazer</button>
        </div>
      )}
    </Folha>
  );
}
