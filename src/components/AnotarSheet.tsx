import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Delete, MessageCircle, X } from 'lucide-react';
import { EVENTO_ANOTAR, avisarLancamentos, registrarSheetAnotar, type PedidoAnotar } from '../lib/anotar';
import { painelToken } from '../painel';
import { openWhatsApp, waLink } from '../whatsapp';
import { addDays, todayBRT } from '../coach';
import { dayAbbr } from '../coachChat/months';
import { CATEGORIAS_SAIDA, FONTES_ENTRADA, GUARDADO, OUTROS, detectarCategoria, detectarFonte, detectarForma, iconeCategoria, rotuloCategoria } from '../lib/categorias';
import { registrarNaMissao, reservaAtiva } from '../missoesAcoes';
import { poucoMovimento, vibrar } from '../lib/celebrar';
import { toast } from './ui/Toast';
import { anotar, apagar, editar } from './mes/api';
import { brlCentavos, diaDe, diaMinimo, digitar, partesDoTexto, teclaDoTeclado, textoDoValor, valorDoTexto, type Tecla } from './mes/mes';

/* ---------- Anotar (spec v2, 7.2; Ouro Antigo 6.7): a folha que sobe do "+ Anotar" ---------- */
// Montada uma vez no App. Com login (o link do WhatsApp), o "+ Anotar" de qualquer tela abre esta folha; sem login,
// continua abrindo o WhatsApp (src/lib/anotar.ts). Também abre preenchida pra corrigir um lançamento (PATCH).
// Celular: folha de baixo com alça (arrastar pra baixo fecha). PC: janela no centro. Esc fecha nos dois.

export function AnotarSheet() {
  const [pedido, setPedido] = useState<{ n: number; p: PedidoAnotar } | null>(null);
  useEffect(() => {
    if (!painelToken()) return;
    registrarSheetAnotar(true);
    let n = 0;
    const abrir = (e: Event) => {
      const p = (e as CustomEvent<PedidoAnotar>).detail ?? {};
      // saiu da conta com a página aberta: volta pro WhatsApp
      if (!painelToken()) return void openWhatsApp(p.origem ?? 'inicio');
      setPedido({ n: ++n, p });
    };
    window.addEventListener(EVENTO_ANOTAR, abrir);
    return () => {
      registrarSheetAnotar(false);
      window.removeEventListener(EVENTO_ANOTAR, abrir);
    };
  }, []);
  if (!pedido) return null;
  return createPortal(<Folha key={pedido.n} pedido={pedido.p} onFechada={() => setPedido(null)} />, document.body);
}

const TECLAS: Tecla[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'apagar'];
const SEGUNDOS_ANIMACAO = 220;

function Folha({ pedido, onFechada }: { pedido: PedidoAnotar; onFechada: () => void }) {
  const ed = pedido.editar ?? null;
  const hoje = todayBRT();
  const ontem = addDays(hoje, -1);
  const diaOriginal = ed ? diaDe(ed.created_at) : hoje;
  const [tipo, setTipo] = useState<'out' | 'in'>(ed?.kind ?? pedido.tipo ?? 'out');
  const [texto, setTexto] = useState(ed ? textoDoValor(ed.amount) : '');
  const [categoria, setCategoria] = useState<string | null>(ed?.category ?? null);
  const [manual, setManual] = useState(Boolean(ed)); // a pessoa escolheu o chip: a descrição não troca mais
  const [descricao, setDescricao] = useState(ed?.description ?? '');
  const [dia, setDia] = useState(diaOriginal);
  const [outroDia, setOutroDia] = useState(diaOriginal !== hoje && diaOriginal !== ontem);
  const reserva = useMemo(() => (ed ? null : reservaAtiva()), [ed]);
  const [praReserva, setPraReserva] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState(false);
  const folha = useRef<HTMLDivElement>(null);
  const antes = useRef<HTMLElement | null>(null);
  const arrasto = useRef<{ id: number; y: number; dy: number } | null>(null);

  const valor = valorDoTexto(texto);
  const partes = partesDoTexto(texto);
  const tamanho = `R$${partes.inteiro}${partes.decimais}`.length;

  // abrir: guarda quem tinha o foco, trava a rolagem da página e sobe a folha
  useEffect(() => {
    antes.current = document.activeElement as HTMLElement | null;
    const raiz = document.documentElement;
    const rolagem = raiz.style.overflow;
    raiz.style.overflow = 'hidden';
    const quadro = requestAnimationFrame(() => {
      setAberta(true);
      folha.current?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(quadro);
      raiz.style.overflow = rolagem;
      antes.current?.focus?.({ preventScroll: true });
    };
  }, []);

  const fechar = () => {
    setAberta(false);
    window.setTimeout(onFechada, poucoMovimento() ? 0 : SEGUNDOS_ANIMACAO);
  };

  const detectar = (t: 'out' | 'in', desc: string) => (t === 'out' ? detectarCategoria(desc) : detectarFonte(desc));

  const trocarTipo = (t: 'out' | 'in') => {
    if (ed || t === tipo) return;
    setTipo(t);
    setManual(false);
    setPraReserva(false);
    setCategoria(detectar(t, descricao));
  };
  const escolherCategoria = (nome: string) => {
    setCategoria(nome);
    setManual(true);
    if (nome !== GUARDADO) setPraReserva(false);
  };
  const mudarDescricao = (v: string) => {
    setDescricao(v);
    if (manual || praReserva) return;
    const achou = detectar(tipo, v);
    if (achou) setCategoria(achou);
  };
  const ligarReserva = (on: boolean) => {
    setPraReserva(on);
    if (on) setCategoria(GUARDADO);
    else if (categoria === GUARDADO) setCategoria(detectar(tipo, descricao));
  };
  const tecla = (k: Tecla) => {
    setErro(null);
    setTexto((t) => digitar(t, k));
  };

  const salvar = async () => {
    if (salvando) return;
    if (!(valor >= 0.01)) {
      setErro('Digite quanto foi no teclado.');
      return;
    }
    const cat = categoria ?? detectar(tipo, descricao) ?? OUTROS;
    const desc = descricao.trim();
    setSalvando(true);
    setErro(null);
    try {
      if (ed) {
        await editar(ed.kind, ed.id, { amount: valor, category: cat, description: desc, ...(dia !== diaOriginal ? { date: dia } : {}) });
        avisarLancamentos({ acao: 'editou' });
        const velho = ed;
        toast('Lançamento corrigido. O saldo do mês já mudou.', {
          acao: {
            rotulo: 'Desfazer',
            onClick: () =>
              void editar(velho.kind, velho.id, { amount: velho.amount, category: velho.category, description: velho.description, ...(dia !== diaOriginal ? { date: diaOriginal } : {}) })
                .then(() => avisarLancamentos({ acao: 'voltou' }))
                .catch(() => toast('Não consegui desfazer agora. Tente corrigir de novo pelo Meu mês.')),
          },
        });
      } else {
        const l = await anotar({ kind: tipo, amount: valor, category: cat, description: desc, method: detectarForma(desc), date: dia, ...(praReserva && reserva ? { missaoId: reserva.id } : {}) });
        // pra reserva: conta na missão (o gasto "Guardado" já é o dinheiro que saiu; não grava de novo no guardado)
        const missao = praReserva && reserva ? registrarNaMissao(reserva.id, valor, { semGuardado: true }) : null;
        avisarLancamentos({ acao: 'anotou', lancamento: l });
        vibrar(20);
        toast(`Anotado: ${brlCentavos(valor)} em ${rotuloCategoria(cat)}`, {
          acao: {
            rotulo: 'Desfazer',
            onClick: () => {
              missao?.desfazer();
              void apagar(l.kind, l.id)
                .then(() => avisarLancamentos({ acao: 'apagou' }))
                .catch(() => toast('Não consegui desfazer agora. Dá pra apagar na lista do Meu mês.'));
            },
          },
        });
      }
      fechar();
    } catch (err) {
      setErro(err instanceof Error && err.message ? err.message : 'Não consegui salvar agora. Tente de novo.');
      setSalvando(false);
    }
  };

  const focaveis = () => [...(folha.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      fechar();
      return;
    }
    if (e.key === 'Tab') {
      // o foco fica dentro da folha
      const lista = focaveis();
      if (!lista.length) return;
      const i = lista.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0 || document.activeElement === folha.current)) {
        e.preventDefault();
        lista[lista.length - 1].focus();
      } else if (!e.shiftKey && i === lista.length - 1) {
        e.preventDefault();
        lista[0].focus();
      }
      return;
    }
    // teclado físico: números, vírgula, apagar e Enter (fora dos campos de texto)
    const alvo = e.target as HTMLElement;
    if (alvo.tagName === 'INPUT') return;
    if (e.key === 'Enter' && alvo.tagName !== 'BUTTON' && alvo.tagName !== 'A') {
      e.preventDefault();
      void salvar();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = teclaDoTeclado(e.key);
    if (k) {
      e.preventDefault();
      tecla(k);
    }
  };

  // arrastar a alça pra baixo fecha (no celular)
  const alcaDesce = (e: React.PointerEvent) => {
    arrasto.current = { id: e.pointerId, y: e.clientY, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // segue sem captura
    }
    if (folha.current) folha.current.style.transition = 'none';
  };
  const alcaMove = (e: React.PointerEvent) => {
    const a = arrasto.current;
    if (!a || a.id !== e.pointerId || !folha.current) return;
    a.dy = Math.max(0, e.clientY - a.y);
    folha.current.style.transform = `translateY(${a.dy}px)`;
  };
  const alcaSobe = (e: React.PointerEvent) => {
    const a = arrasto.current;
    arrasto.current = null;
    const el = folha.current;
    if (!a || a.id !== e.pointerId || !el) return;
    el.style.transition = '';
    el.style.transform = '';
    if (a.dy > 110) fechar();
  };

  const opcoes = tipo === 'out' ? CATEGORIAS_SAIDA.map((c) => c.nome) : FONTES_ENTRADA.map((f) => f.nome);
  // categoria que veio do WhatsApp e não está na lista: aparece também, pra não sumir ao corrigir
  if (categoria && !opcoes.includes(categoria)) opcoes.unshift(categoria);
  const diaEscolhido = !outroDia ? null : dia;

  return (
    <div className={`anotar ${aberta ? 'aberta' : ''}`}>
      <div className="anotar-fundo" onClick={fechar} aria-hidden="true" />
      <div ref={folha} className="anotar-folha" role="dialog" aria-modal="true" aria-labelledby="anotar-titulo" tabIndex={-1} onKeyDown={aoTeclar}>
        <div className="anotar-alca" onPointerDown={alcaDesce} onPointerMove={alcaMove} onPointerUp={alcaSobe} onPointerCancel={alcaSobe} aria-hidden="true">
          <i />
        </div>
        <div className="anotar-topo">
          <h2 id="anotar-titulo">{ed ? 'Corrigir lançamento' : 'Anotar'}</h2>
          <button type="button" className="anotar-fechar" aria-label="Fechar" onClick={fechar}>
            <X size={20} />
          </button>
        </div>

        <div className="anotar-corpo">
          <div className="anotar-tipo" role="radiogroup" aria-label="Saída ou entrada">
            {(['out', 'in'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tipo === t} className={tipo === t ? 'on' : ''} disabled={Boolean(ed) && tipo !== t} onClick={() => trocarTipo(t)}>
                {t === 'out' ? 'Saída' : 'Entrada'}
              </button>
            ))}
          </div>

          <p className={`anotar-valor ${tamanho > 11 ? 'menor' : tamanho > 8 ? 'medio' : ''} ${valor > 0 ? '' : 'vazio'}`} aria-live="polite" aria-label={`Valor: ${brlCentavos(valor)}`}>
            <span className="moeda" aria-hidden="true">R$</span>
            <span aria-hidden="true">{partes.inteiro}</span>
            {partes.decimais && <span className="centavos" aria-hidden="true">{partes.decimais}</span>}
          </p>

          <div className="anotar-cats" role="radiogroup" aria-label={tipo === 'out' ? 'Categoria' : 'De onde veio'}>
            {opcoes.map((nome) => {
              const Icone = iconeCategoria(nome, tipo);
              const on = categoria === nome;
              return (
                <button key={nome} type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => escolherCategoria(nome)}>
                  <Icone size={16} strokeWidth={1.9} aria-hidden="true" />
                  {tipo === 'out' ? rotuloCategoria(nome) : nome}
                </button>
              );
            })}
          </div>

          <label className="anotar-campo">
            <span>Descrição (opcional)</span>
            <input
              className="field-input"
              value={descricao}
              maxLength={80}
              placeholder={tipo === 'out' ? 'Ex.: mercado, uber, ifood' : 'Ex.: salário, freela'}
              onChange={(e) => mudarDescricao(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void salvar();
                }
              }}
            />
          </label>

          <div className="anotar-dia" role="group" aria-label="Quando foi">
            <button type="button" aria-pressed={!outroDia && dia === hoje} className={!outroDia && dia === hoje ? 'on' : ''} onClick={() => { setOutroDia(false); setDia(hoje); }}>
              Hoje
            </button>
            <button type="button" aria-pressed={!outroDia && dia === ontem} className={!outroDia && dia === ontem ? 'on' : ''} onClick={() => { setOutroDia(false); setDia(ontem); }}>
              Ontem
            </button>
            <button type="button" aria-pressed={outroDia} className={outroDia ? 'on' : ''} onClick={() => setOutroDia(true)}>
              {diaEscolhido && diaEscolhido !== hoje && diaEscolhido !== ontem ? dayAbbr(diaEscolhido) : 'Outro dia'}
            </button>
          </div>
          {outroDia && (
            <label className="anotar-campo anotar-data">
              <span>Escolha o dia</span>
              <input className="field-input" type="date" value={dia} min={diaMinimo(hoje)} max={hoje} onChange={(e) => setDia(e.target.value && e.target.value <= hoje ? e.target.value : hoje)} />
            </label>
          )}

          {reserva && tipo === 'out' && (
            <button type="button" role="switch" aria-checked={praReserva} className={`anotar-reserva ${praReserva ? 'on' : ''}`} onClick={() => ligarReserva(!praReserva)}>
              <span className="anotar-chave" aria-hidden="true"><i /></span>
              <span>
                <b>Isso foi pra minha reserva</b>
                <small>Conta na missão “{reserva.titulo}”.</small>
              </span>
            </button>
          )}

          <div className="anotar-teclado">
            {TECLAS.map((k) => (
              <button key={k} type="button" className={k === 'apagar' || k === ',' ? 'sinal' : ''} aria-label={k === 'apagar' ? 'Apagar o último número' : k === ',' ? 'Vírgula' : undefined} onClick={() => tecla(k)}>
                {k === 'apagar' ? <Delete size={22} strokeWidth={1.75} /> : k}
              </button>
            ))}
          </div>
        </div>

        <div className="anotar-pe">
          {erro && (
            <p className="anotar-erro" role="alert">
              {erro}
            </p>
          )}
          <button type="button" className="btn-primary anotar-salvar" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? 'Salvando…' : ed ? 'Salvar correção' : valor > 0 ? `Anotar ${brlCentavos(valor)}` : 'Anotar'}
          </button>
          {!ed && (
            <a className="anotar-wa" href={waLink('menu')} target="_blank" rel="noreferrer">
              <MessageCircle size={14} aria-hidden="true" /> Prefere o WhatsApp? Mande “mercado 80 no pix”.
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
