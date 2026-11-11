import { useState } from 'react';
import { BottomSheet, Card, CartaoDestino, Citacao, EmptyState, Eyebrow, LinhaDoTempo, Lista, ListItem, Marco, Moeda, NumPad, Passo, ProgressRing, Segmented, Skeleton, StatusDot, ToolGrid, ToolHeader, ToolTile } from './base';

/** Página interna (/dev/ui): todos os componentes base num lugar só, para revisar o visual. */
export function DevUI() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [folha, setFolha] = useState(false);
  const [v, setV] = useState(35);
  return (
    <>
      <ToolHeader para="/" rotulo="Caminho" />
      <h1 className="gs-titulo">Componentes</h1>
      <p className="gs-sub">Dados de exemplo. Nada aqui é salvo.</p>

      <h2 className="cm-h2">CartaoDestino</h2>
      <CartaoDestino rotulo="Seu destino agora" antes="Livre de todas as dívidas em" data="agosto de 2027" texto="Faltam R$ 4.200. Você está pagando R$ 470 por mês." progresso={38} pe={<><span>faltam R$ 4.200 · 9 meses</span><button type="button" className="cm-link">Ver o caminho todo</button></>} />

      <h2 className="cm-h2">Moeda</h2>
      <Card><div style={{ display: 'flex', gap: 24, alignItems: 'center' }}><Moeda tamanho={28} /><Moeda tamanho={46} /><Moeda tamanho={88} /><Moeda tamanho={46} girar={false} /></div></Card>

      <h2 className="cm-h2">LinhaDoTempo e Passo</h2>
      <LinhaDoTempo rotulo="Passos de exemplo">
        <Passo n={1} estado="feito" titulo="Pagar Aluguel de out/26" detalhe="Feito: R$ 1.020 pagos." />
        <Passo n={2} estado="atual" destaque titulo="Pagar Internet" detalhe="R$ 99,90 · vence amanhã."><div className="gs-acoes"><button type="button" className="gs-btn">Dar baixa</button></div></Passo>
        <Passo n={3} estado="segurado" titulo="Guardar R$ 400 deste mês" detalhe="Segurado enquanto houver conta atrasada." />
        <Passo n={4} estado="continuo" titulo="Gastar até R$ 62,00 por dia" detalhe="Sobram R$ 1.300 para 21 dias." />
      </LinhaDoTempo>

      <h2 className="cm-h2">Marco e Selo</h2>
      <LinhaDoTempo rotulo="Marcos de exemplo">
        <Marco n={1} estado="feito" titulo="Em dia com as contas" selo="Selo da Ordem" />
        <Marco n={2} estado="atual" titulo="Livre das dívidas caras" data="março de 2027" selo="Selo da Saída" />
        <Marco n={3} estado="futuro" titulo="Reserva de emergência completa" data="junho de 2028" selo="Selo do Escudo" />
      </LinhaDoTempo>

      <h2 className="cm-h2">ToolTile</h2>
      <ToolGrid>
        <ToolTile titulo="Sair do atraso" resolve="Tô com conta atrasada. O que pago primeiro?" status="1 atrasada · em dia em fev/27" tom="perigo" rota="/dev/ui" continuar="Continuar (passo 2 de 3)" />
        <ToolTile titulo="Quitar dívidas" resolve="Quando eu saio das dívidas?" status="livre em ago/27" tom="aviso" rota="/dev/ui" />
        <ToolTile titulo="Reserva de emergência" resolve="Quanto já guardei?" status="R$ 300 de R$ 9.015" rota="/dev/ui" />
        <ToolTile titulo="Contas fixas" resolve="O que falta pagar este mês?" status="Tudo pago este mês" tom="ok" rota="/dev/ui" />
      </ToolGrid>

      <h2 className="cm-h2">ListItem, StatusDot e Segmented</h2>
      <Segmented rotulo="Exemplo" valor={seg} onChange={setSeg} opcoes={[{ id: 'a', nome: 'A pagar' }, { id: 'b', nome: 'Pagas' }, { id: 'c', nome: 'Todas' }]} />
      <Lista rotulo="Contas de exemplo">
        <ListItem faixa="3 dias atrás" tomFaixa="perigo" titulo="Internet" sub="venceu dia 7" valor="R$ 99,90" acao={<button type="button" className="gs-btn pequeno">Pagar</button>} />
        <ListItem faixa="amanhã" tomFaixa="aviso" titulo="Luz" sub="vence dia 11" valor="R$ 180,00" />
        <ListItem faixa="dia 25" titulo="Condomínio" valor="R$ 420,00" rota="/dev/ui" />
      </Lista>
      <p><StatusDot tom="perigo">atrasada</StatusDot> · <StatusDot tom="aviso">atenção</StatusDot> · <StatusDot tom="ok">em ordem</StatusDot> · <StatusDot>sem estado</StatusDot></p>

      <h2 className="cm-h2">ProgressRing</h2>
      <Card><div style={{ display: 'flex', gap: 20, alignItems: 'center' }}><ProgressRing pct={34} rotulo="Reserva"><Moeda tamanho={56} /></ProgressRing><div><Eyebrow>Reserva</Eyebrow><b className="cm-num" style={{ fontSize: 32, display: 'block' }}>R$ 3.060</b><span className="cm-mudo">de R$ 9.015</span></div></div></Card>

      <h2 className="cm-h2">BottomSheet e NumPad</h2>
      <button type="button" className="gs-btn" onClick={() => setFolha(true)}>Abrir a folha</button>
      <BottomSheet aberta={folha} onFechar={() => setFolha(false)} titulo="Quanto foi?"><NumPad valor={v} onChange={setV} /><div className="gs-acoes" style={{ marginTop: 14 }}><button type="button" className="gs-btn cheio" onClick={() => setFolha(false)}>Pronto</button></div></BottomSheet>

      <h2 className="cm-h2">EmptyState e Skeleton</h2>
      <EmptyState titulo="Nenhuma conta por aqui" texto="Cadastre a primeira e eu aviso antes de vencer." acao={<button type="button" className="gs-btn">Cadastrar conta</button>} />
      <Card><Skeleton altura={28} largura="60%" /><Skeleton /><Skeleton largura="80%" /></Card>

      <h2 className="cm-h2">Citacao</h2>
      <Citacao texto="Uma parte de tudo o que você ganha é sua para guardar." />
    </>
  );
}
