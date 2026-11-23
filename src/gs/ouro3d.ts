// Pilha de moedas e barras de ouro em 3D (three.js). A altura da pilha mostra o quanto a pessoa já guardou da reserva.
// Ouro de verdade: metal polido com reflexo de ambiente, borda serrilhada, relevo no rosto da moeda, sombra no chão.
// Carrega só quando o Início abre. Sem WebGL, o hero mostra uma versão estática.

import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DirectionalLight, Group, LatheGeometry,
  Mesh, MeshPhysicalMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, RepeatWrapping, Scene, ShadowMaterial,
  SRGBColorSpace, Vector2, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface PilhaOuro { moedas: number; barras: number }
export interface CenaOuro { definir(p: PilhaOuro): void; inclinar(px: number, py: number): void; destruir(): void }

export function webglDisponivel(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const R = 1; const T = 0.17;

function perfilMoeda(): Vector2[] {
  const p: Vector2[] = [];
  const b = 0.05;
  p.push(new Vector2(0, -T / 2 + 0.035));
  p.push(new Vector2(R - 0.16, -T / 2 + 0.035));
  p.push(new Vector2(R - 0.12, -T / 2));
  p.push(new Vector2(R - b, -T / 2));
  for (let i = 1; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); p.push(new Vector2(R - b + Math.sin(a) * b, -T / 2 + b - Math.cos(a) * b)); }
  p.push(new Vector2(R, T / 2 - b));
  for (let i = 1; i <= 5; i++) { const a = (i / 5) * (Math.PI / 2); p.push(new Vector2(R - b + Math.cos(a) * b, T / 2 - b + Math.sin(a) * b)); }
  p.push(new Vector2(R - b, T / 2));
  p.push(new Vector2(R - 0.12, T / 2));
  p.push(new Vector2(R - 0.16, T / 2 - 0.035));
  p.push(new Vector2(0, T / 2 - 0.035));
  return p;
}

function texturaRosto(): CanvasTexture {
  const N = 512;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d')!;
  x.fillStyle = '#808080'; x.fillRect(0, 0, N, N);
  const ring = (r: number, w: number, v: number) => { x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = w; x.beginPath(); x.arc(N / 2, N / 2, r, 0, Math.PI * 2); x.stroke(); };
  ring(N * 0.45, 10, 205); ring(N * 0.39, 4, 60);
  x.fillStyle = 'rgb(215,215,215)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '700 330px Georgia, "Times New Roman", serif'; x.fillText('S', N / 2, N / 2 + 14);
  x.fillStyle = 'rgb(70,70,70)'; x.font = '700 34px Georgia, serif';
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; x.save(); x.translate(N / 2 + Math.cos(a) * N * 0.42, N / 2 + Math.sin(a) * N * 0.42); x.rotate(a + Math.PI / 2); x.fillText('•', 0, 0); x.restore(); }
  const t = new CanvasTexture(c); t.anisotropy = 4; return t;
}

function texturaSerrilha(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 8;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 256; i += 4) { x.fillStyle = '#d8d8d8'; x.fillRect(i, 0, 2, 8); x.fillStyle = '#4a4a4a'; x.fillRect(i + 2, 0, 2, 8); }
  const t = new CanvasTexture(c); t.wrapS = RepeatWrapping; t.repeat.set(2, 1); return t;
}

function texturaBarra(): CanvasTexture {
  const W = 512; const H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgb(200,200,200)'; x.lineWidth = 6; x.strokeRect(22, 22, W - 44, H - 44);
  x.fillStyle = 'rgb(225,225,225)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '700 64px Georgia, serif'; x.fillText('GRANA SÉRIA', W / 2, H * 0.36);
  x.font = '600 42px Georgia, serif'; x.fillText('OURO · 999,9', W / 2, H * 0.62);
  x.font = '500 28px Georgia, serif'; x.fillText('1 000 g', W / 2, H * 0.82);
  const t = new CanvasTexture(c); t.anisotropy = 4; return t;
}

export function criarCena(host: HTMLElement): CenaOuro {
  const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(renderer.domElement);

  const cena = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  cena.environment = ambiente;
  cena.environmentIntensity = 1.35;
  cena.add(new AmbientLight(0xfff4dc, 0.35));
  const sol = new DirectionalLight(0xfff1cf, 2.4);
  sol.position.set(-4, 7, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = -6; sol.shadow.camera.right = 6; sol.shadow.camera.top = 6; sol.shadow.camera.bottom = -6;
  sol.shadow.radius = 5; sol.shadow.bias = -0.0005;
  cena.add(sol);
  const recorte = new DirectionalLight(0x9fe8c4, 0.8);
  recorte.position.set(5, 3, -4);
  cena.add(recorte);

  const camera = new PerspectiveCamera(26, 1, 0.1, 100);
  const mundo = new Group();
  cena.add(mundo);

  const ouro = new MeshPhysicalMaterial({ color: new Color('#E4B24A'), metalness: 1, roughness: 0.24, clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 1.5 });
  const rosto = texturaRosto();
  const ouroRosto = new MeshPhysicalMaterial({ color: new Color('#E4B24A'), metalness: 1, roughness: 0.2, bumpMap: rosto, bumpScale: 2.2, envMapIntensity: 1.6 });
  const serr = texturaSerrilha();
  const ouroBorda = new MeshPhysicalMaterial({ color: new Color('#D9A63F'), metalness: 1, roughness: 0.3, bumpMap: serr, bumpScale: 1.6, envMapIntensity: 1.4 });
  const barraTex = texturaBarra();
  const ouroBarra = new MeshPhysicalMaterial({ color: new Color('#E0AD45'), metalness: 1, roughness: 0.26, bumpMap: barraTex, bumpScale: 1.8, envMapIntensity: 1.5 });
  const geoMoeda = new LatheGeometry(perfilMoeda(), 72);
  const geoBorda = new CylinderGeometry(R + 0.002, R + 0.002, T - 0.08, 96, 1, true);
  const geoRosto = new CircleGeometry(R - 0.17, 64);
  const geoBarra = new RoundedBoxGeometry(2.7, 0.82, 1.35, 5, 0.11);
  const geoBarraTopo = new PlaneGeometry(2.3, 1.0);
  const chao = new Mesh(new PlaneGeometry(40, 40), new ShadowMaterial({ opacity: 0.5 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  mundo.add(chao);

  type Peca = { g: Group; y: number; atraso: number };
  let pecas: Peca[] = [];
  let pilha: PilhaOuro = { moedas: 0, barras: 0 };
  let t0 = performance.now();
  let rotY = 0; let alvoRy = 0; let rx = 0; let alvoRx = 0;
  let visivel = true; let parar = false; let raf = 0; let ultimo = performance.now();
  let largura = 1; let altura = 1;

  const moeda = (topo: boolean, deitada: boolean): Group => {
    const g = new Group();
    const corpo = new Mesh(geoMoeda, ouro); corpo.castShadow = true; corpo.receiveShadow = true;
    const borda = new Mesh(geoBorda, ouroBorda); borda.castShadow = true;
    g.add(corpo, borda);
    if (topo || deitada) {
      const f = new Mesh(geoRosto, ouroRosto);
      f.rotation.x = -Math.PI / 2; f.position.y = T / 2 - 0.034;
      g.add(f);
    }
    return g;
  };

  const montar = () => {
    for (const p of pecas) mundo.remove(p.g);
    pecas = [];
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const n = Math.max(3, Math.min(30, pilha.moedas));
    for (let i = 0; i < n; i++) {
      const g = moeda(i === n - 1, false);
      const y = T / 2 + i * (T + 0.004);
      g.position.set((rnd() - 0.5) * 0.05, y, (rnd() - 0.5) * 0.05);
      g.rotation.y = rnd() * Math.PI * 2;
      g.rotation.z = (rnd() - 0.5) * 0.012;
      mundo.add(g);
      pecas.push({ g, y, atraso: 0.04 * i });
    }
    // moedas soltas ao redor: uma deitada mostrando o rosto, uma encostada na pilha
    const solta = moeda(false, true); solta.position.set(1.85, T / 2, 0.55); solta.rotation.y = 0.6; mundo.add(solta); pecas.push({ g: solta, y: T / 2, atraso: 0.2 + n * 0.02 });
    const solta2 = moeda(false, true); solta2.position.set(1.7, T / 2 + T + 0.004, 0.62); solta2.rotation.y = 2.2; mundo.add(solta2); pecas.push({ g: solta2, y: T / 2 + T + 0.004, atraso: 0.28 + n * 0.02 });
    const encostada = moeda(false, true); encostada.position.set(-1.15, 0.97, 0.7); encostada.rotation.set(0, 0.4, 1.28); mundo.add(encostada); pecas.push({ g: encostada, y: 0.97, atraso: 0.36 + n * 0.02 });
    // barras: empilhadas atrás e à esquerda
    const nb = Math.max(0, Math.min(4, pilha.barras));
    for (let i = 0; i < nb; i++) {
      const g = new Group();
      const b = new Mesh(geoBarra, ouroBarra); b.castShadow = true; b.receiveShadow = true; g.add(b);
      const y = 0.41 + (i >= 2 ? 0.82 : 0);
      const col = i % 2;
      g.position.set(-2.55 + (i >= 2 ? 0.25 : 0), y, -1.55 + col * 0.0 - (i % 2) * 1.4 + 0.7);
      g.rotation.y = 0.12 - i * 0.05;
      mundo.add(g);
      pecas.push({ g, y, atraso: 0.45 + i * 0.12 });
    }
    t0 = performance.now();
  };

  const enquadrar = () => {
    const alt = Math.max(2.2, Math.min(30, pilha.moedas) * (T + 0.004) + 1.2);
    const dist = 9.2 + alt * 0.5;
    camera.aspect = largura / altura;
    camera.position.set(-0.1, alt * 0.5 + 2.6, dist);
    camera.lookAt(-0.55, alt * 0.38, 0);
    camera.updateProjectionMatrix();
  };

  const desenhar = (dt: number) => {
    const t = (performance.now() - t0) / 1000;
    rotY += (alvoRy - rotY) * Math.min(1, dt * 5);
    rx += (alvoRx - rx) * Math.min(1, dt * 5);
    mundo.rotation.y = reduz ? 0.5 : t * 0.22 + rotY + 0.5;
    mundo.rotation.x = rx;
    for (const p of pecas) {
      const k = reduz ? 1 : Math.max(0, Math.min(1, (t - p.atraso) / 0.55));
      const e = 1 - (1 - k) ** 3;
      const quique = k < 1 ? 0 : Math.max(0, Math.sin((t - p.atraso - 0.55) * 14)) * Math.exp(-(t - p.atraso - 0.55) * 7) * 0.05;
      p.g.position.y = p.y + (1 - e) * 5.5 + quique;
      p.g.visible = k > 0.001;
    }
    renderer.render(cena, camera);
  };
  const ciclo = () => {
    if (parar) return;
    const agora = performance.now(); const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
    if (visivel && document.visibilityState === 'visible') desenhar(dt);
    raf = requestAnimationFrame(ciclo);
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    const w = Math.max(40, host.clientWidth); const h = Math.max(40, host.clientHeight);
    if (w === largura && h === altura) return;
    largura = w; altura = h; renderer.setSize(w, h, false); enquadrar(); if (reduz) desenhar(0.016);
  }) : null;
  ro?.observe(host);
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((it) => { visivel = it[0]?.isIntersecting ?? true; }) : null;
  io?.observe(host);
  largura = Math.max(40, host.clientWidth); altura = Math.max(40, host.clientHeight);
  renderer.setSize(largura, altura, false);

  return {
    definir(p) {
      if (pecas.length && p.moedas === pilha.moedas && p.barras === pilha.barras) return;
      pilha = p; montar(); enquadrar();
      if (reduz) desenhar(0.016); else if (!raf) { ultimo = performance.now(); raf = requestAnimationFrame(ciclo); }
    },
    inclinar(px, py) { if (!reduz) { alvoRy = (px - 0.5) * 0.9; alvoRx = (py - 0.5) * 0.12; } },
    destruir() {
      parar = true; cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect();
      [geoMoeda, geoBorda, geoRosto, geoBarra, geoBarraTopo].forEach((g) => g.dispose());
      [ouro, ouroRosto, ouroBorda, ouroBarra].forEach((m) => m.dispose());
      [rosto, serr, barraTex, ambiente].forEach((t) => t.dispose());
      chao.geometry.dispose(); (chao.material as ShadowMaterial).dispose();
      pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
