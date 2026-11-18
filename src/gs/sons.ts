// Sons da interface, gerados na hora com o Web Audio API (osciladores e um sopro curto de ruído).
// Não há arquivo de áudio de terceiro: o som é original deste projeto e pode ser usado comercialmente.
// A preferência fica numa chave nova, "gs-sons" ("1" ligado, "0" desligado). Sem a chave, fica ligado.
// Nada toca antes do primeiro gesto (toque, clique ou tecla): o AudioContext só nasce depois disso.

import { useSyncExternalStore } from 'react';

export const CHAVE_SONS = 'gs-sons';
export type TipoSom = 'toque' | 'navegar' | 'sucesso' | 'erro';

const ouvintes = new Set<() => void>();
let gesto = false;
let ctx: AudioContext | null = null;

export function sonsLigados(): boolean {
  try {
    const v = localStorage.getItem(CHAVE_SONS);
    if (v === null || v === '') return true;
    return v === '1' || v === 'on' || v === 'true';
  } catch {
    return true;
  }
}

export function definirSons(ligado: boolean) {
  try { localStorage.setItem(CHAVE_SONS, ligado ? '1' : '0'); } catch { /* vale só nesta visita */ }
  ouvintes.forEach((f) => f());
}

export function assinarSons(f: () => void) {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

export function useSonsLigados(): boolean {
  return useSyncExternalStore(assinarSons, sonsLigados, () => true);
}

/** O primeiro gesto da pessoa destrava o áudio. Antes disso, tocar() não faz nada. */
export function marcarGesto() {
  gesto = true;
}

export function audioLiberado(): boolean {
  return gesto && sonsLigados();
}

/** Só para os testes: o módulo guarda o gesto entre casos. */
export function reiniciarSonsParaTeste() {
  gesto = false;
  ctx = null;
}

function contexto(): AudioContext | null {
  if (typeof window === 'undefined' || !audioLiberado()) return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function nota(ctxAtual: AudioContext, destino: AudioNode, freq: number, quando: number, dur: number, onda: OscillatorType, pico: number) {
  const o = ctxAtual.createOscillator();
  const g = ctxAtual.createGain();
  o.type = onda;
  o.frequency.setValueAtTime(freq, quando);
  g.gain.setValueAtTime(0.0001, quando);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), quando + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
  o.connect(g);
  g.connect(destino);
  o.start(quando);
  o.stop(quando + dur + 0.02);
}

function emitir(ctxAtual: AudioContext, tipo: TipoSom) {
  const agora = ctxAtual.currentTime;
  const master = ctxAtual.createGain();
  master.gain.setValueAtTime(0.42, agora);
  master.connect(ctxAtual.destination);
  if (tipo === 'toque') {
    nota(ctxAtual, master, 784, agora, 0.055, 'sine', 0.045);
    return;
  }
  if (tipo === 'navegar') {
    const amostras = Math.floor(ctxAtual.sampleRate * 0.16);
    const buffer = ctxAtual.createBuffer(1, amostras, ctxAtual.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < dados.length; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / dados.length) ** 2;
    const src = ctxAtual.createBufferSource();
    src.buffer = buffer;
    const filtro = ctxAtual.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.setValueAtTime(0.6, agora);
    filtro.frequency.setValueAtTime(420, agora);
    filtro.frequency.exponentialRampToValueAtTime(1600, agora + 0.14);
    const g = ctxAtual.createGain();
    g.gain.setValueAtTime(0.03, agora);
    g.gain.exponentialRampToValueAtTime(0.0001, agora + 0.16);
    src.connect(filtro);
    filtro.connect(g);
    g.connect(master);
    src.start(agora);
    src.stop(agora + 0.17);
    return;
  }
  if (tipo === 'sucesso') {
    nota(ctxAtual, master, 523.25, agora, 0.11, 'sine', 0.04);
    nota(ctxAtual, master, 659.25, agora + 0.07, 0.16, 'sine', 0.035);
    nota(ctxAtual, master, 783.99, agora + 0.14, 0.2, 'triangle', 0.02);
    return;
  }
  nota(ctxAtual, master, 196, agora, 0.14, 'triangle', 0.04);
  nota(ctxAtual, master, 155.56, agora + 0.06, 0.16, 'sine', 0.028);
}

/** Vibração curta, só onde o aparelho deixa e quem não pediu menos movimento. */
export function vibrar(ms: number | number[]) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate(ms);
  } catch { /* sem motor */ }
}

export function tocar(tipo: TipoSom) {
  vibrar(tipo === 'sucesso' ? [8, 30, 12] : tipo === 'erro' ? [14, 40, 14] : 8);
  const ctxAtual = contexto();
  if (!ctxAtual) return;
  const play = () => { if (ctxAtual.state === 'running' && sonsLigados()) emitir(ctxAtual, tipo); };
  if (ctxAtual.state === 'running') play();
  else void ctxAtual.resume().then(play).catch(() => undefined);
}

/** Sucesso quando a pessoa salva; erro quando a frase diz que não deu. O resto fica em silêncio. */
export function tipoDoAviso(texto: string): 'sucesso' | 'erro' | null {
  const t = texto.toLowerCase();
  if (/não consegui|nao consegui|confira|inválid|invalido|não pode|nao pode|erro/.test(t)) return 'erro';
  if (/anotad|salv|registrad|criad|guardad|atualizad|parabéns|parabens|batida|liberad|feito|feita|pago|copiad|desfeito/.test(t)) return 'sucesso';
  return null;
}
