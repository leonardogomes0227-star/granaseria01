// A carteira de couro em 3D (three.js), no estilo da referência: peça da frente com a borda de cima curvada para dentro,
// espessura e quina arredondada de verdade, costura dourada que acompanha o contorno, forro escuro e cartões das contas
// aparecendo por trás. A unidade da cena é o PIXEL do CSS (a câmera deixa o plano z=0 bater 1:1 com a tela), então o texto em
// HTML (saldo, botões) fica exatamente em cima da frente da carteira.

import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, Color, DirectionalLight, ExtrudeGeometry, Group, InstancedMesh, MathUtils, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator,
  RepeatWrapping, Scene, Shape, SRGBColorSpace, WebGLRenderer, DoubleSide,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface CartaoBolsa { rotulo: string; valor: string; cor: string; corTexto: string; marca?: string }
export interface LayoutBolsa { largura: number; altura: number; frente: { x: number; y: number; w: number; h: number }; faixa: number }
export interface CenaBolsa { atualizar(l: LayoutBolsa, cartoes: CartaoBolsa[], aberta: boolean): void; inclinar(px: number, py: number): void; destruir(): void }

export function webglDisponivel(): boolean {
  try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** Couro: poros e rugas finas num canvas, usado como relevo (bump) e como variação de cor. */
function texturaCouro(): { bump: CanvasTexture; cor: CanvasTexture } {
  const T = 512;
  const b = document.createElement('canvas'); b.width = b.height = T;
  const c = document.createElement('canvas'); c.width = c.height = T;
  const bx = b.getContext('2d')!; const cx = c.getContext('2d')!;
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, T, T);
  cx.fillStyle = '#134836'; cx.fillRect(0, 0, T, T);
  let s = 13;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 11000; i++) {
    const x = rnd() * T; const y = rnd() * T; const r = 1.2 + rnd() * 3; const v = Math.floor(60 + rnd() * 130);
    bx.fillStyle = `rgba(${v},${v},${v},.55)`; bx.beginPath(); bx.arc(x, y, r, 0, Math.PI * 2); bx.fill();
    const g = 40 + Math.floor(rnd() * 34);
    cx.fillStyle = `rgba(${g - 24},${g + 30},${g + 4},.30)`; cx.beginPath(); cx.arc(x, y, r * 1.3, 0, Math.PI * 2); cx.fill();
  }
  bx.strokeStyle = 'rgba(40,40,40,.4)'; bx.lineWidth = 1;
  for (let i = 0; i < 320; i++) { const x = rnd() * T; const y = rnd() * T; const a = rnd() * Math.PI * 2; const l = 12 + rnd() * 38; bx.beginPath(); bx.moveTo(x, y); bx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); bx.stroke(); }
  const mk = (cv: HTMLCanvasElement, cor: boolean) => {
    const t = new CanvasTexture(cv); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1 / 420, 1 / 420); t.anisotropy = 4; if (cor) t.colorSpace = SRGBColorSpace; return t;
  };
  return { bump: mk(b, false), cor: mk(c, true) };
}

function texturaRotulo(c: CartaoBolsa, w: number, h: number): CanvasTexture {
  const k = 2;
  const cv = document.createElement('canvas'); cv.width = w * k; cv.height = h * k;
  const x = cv.getContext('2d')!; x.scale(k, k);
  x.fillStyle = c.corTexto; x.textBaseline = 'middle';
  x.font = '700 24px "Plus Jakarta Sans", "Manrope", system-ui, sans-serif'; x.textAlign = 'left';
  x.fillText(c.marca ?? c.rotulo, 0, h / 2);
  x.font = '600 22px "Plus Jakarta Sans", "Manrope", system-ui, sans-serif'; x.textAlign = 'right'; x.globalAlpha = 0.9;
  x.fillText(c.valor, w, h / 2);
  const t = new CanvasTexture(cv); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Contorno da peça da frente: cantos de baixo arredondados e a borda de cima curvada para dentro (a "boca" da carteira). */
function contornoFrente(w: number, h: number, r: number, fundo: number): Shape {
  const s = new Shape();
  const x0 = -w / 2; const x1 = w / 2; const y0 = -h / 2; const y1 = h / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  // a boca: desce suavemente até o meio e volta
  s.bezierCurveTo(x1 - w * 0.22, y1 - fundo * 0.15, w * 0.2, y1 - fundo, 0, y1 - fundo);
  s.bezierCurveTo(-w * 0.2, y1 - fundo, x0 + w * 0.22, y1 - fundo * 0.15, x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

export function criarBolsa(host: HTMLElement): CenaBolsa {
  const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;position:absolute;left:0;top:0';
  host.appendChild(renderer.domElement);

  const cena = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environment = ambiente; cena.environmentIntensity = 0.7;
  cena.add(new AmbientLight(0xffffff, 0.18));
  const sol = new DirectionalLight(0xfff0d2, 2.0);
  sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.bias = -0.0004; sol.shadow.radius = 7;
  cena.add(sol, sol.target);
  const recorte = new DirectionalLight(0x8fe0bd, 0.9); recorte.position.set(360, 120, -200); cena.add(recorte);

  const camera = new PerspectiveCamera(20, 1, 10, 8000);
  const grupo = new Group(); cena.add(grupo);
  const { bump, cor } = texturaCouro();
  const couro = new MeshPhysicalMaterial({ color: new Color('#cfe6dc'), map: cor, bumpMap: bump, bumpScale: 2.2, roughness: 0.52, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.45, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new Color('#4fae88'), envMapIntensity: 0.85 });
  const forro = new MeshPhysicalMaterial({ color: new Color('#8fbfaa'), map: cor, bumpMap: bump, bumpScale: 1.6, roughness: 0.68, envMapIntensity: 0.55 });
  const ouroFio = new MeshStandardMaterial({ color: new Color('#E6C064'), metalness: 1, roughness: 0.3, envMapIntensity: 1.4 });

  const itens: Object3D[] = [];
  const cartoes3d: { corpo: Mesh; rotulo: Mesh; y0: number; atraso: number }[] = [];
  let atual: LayoutBolsa | null = null; let abertaT = 0; let aberta = false;
  let entrada = reduz ? 1 : 0; let alvoRx = 0; let alvoRy = 0; let rx = 0; let ry = 0;
  let visivel = true; let parar = false; let raf = 0; let ultimo = performance.now(); let chave = '';

  const limpar = () => {
    for (const o of itens) { grupo.remove(o); const m = o as Mesh; m.geometry?.dispose(); const mat = m.material as MeshBasicMaterial | undefined; if (mat && mat !== (couro as unknown) && mat !== (forro as unknown) && mat !== (ouroFio as unknown)) { mat.map?.dispose(); mat.dispose(); } }
    itens.length = 0; cartoes3d.length = 0;
  };
  const add = <T extends Object3D>(o: T) => { grupo.add(o); itens.push(o); return o; };

  const montar = (l: LayoutBolsa, cartoes: CartaoBolsa[]) => {
    limpar(); atual = l;
    renderer.setSize(l.largura, l.altura, false);
    renderer.domElement.style.width = `${l.largura}px`; renderer.domElement.style.height = `${l.altura}px`;
    camera.aspect = l.largura / l.altura;
    camera.position.set(0, 0, (l.altura / 2) / Math.tan(MathUtils.degToRad(camera.fov / 2)));
    camera.far = camera.position.z * 3; camera.updateProjectionMatrix();
    const cx = (px: number) => px - l.largura / 2; const cy = (py: number) => l.altura / 2 - py;
    const f = l.frente;
    const raio = Math.min(46, f.h / 5); const fundo = Math.min(44, f.h * 0.16);

    // peça de trás (forro): mais alta, mostra as "orelhas" nos cantos de cima
    const trasH = f.h + l.faixa * 0.5;
    const traseira = new Mesh(new ExtrudeGeometry(contornoFrente(f.w - 4, trasH, raio, 10), { depth: 14, bevelEnabled: true, bevelThickness: 7, bevelSize: 7, bevelSegments: 5, curveSegments: 40 }), forro);
    traseira.position.set(cx(f.x + f.w / 2), cy(f.y + f.h / 2) + (trasH - f.h) / 2, -46);
    traseira.castShadow = true; traseira.receiveShadow = true; add(traseira);

    // cartões entre a traseira e a frente
    const topoCartoes = f.y - l.faixa;
    cartoes.forEach((c, i) => {
      const faixaI = l.faixa / Math.max(1, cartoes.length);
      const topo = topoCartoes + i * faixaI;
      const cw = f.w - 34; const ch = 230;
      const material = new MeshPhysicalMaterial({ color: new Color(c.cor), metalness: 0.2, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.9 });
      const corpo = new Mesh(new RoundedBoxGeometry(cw, ch, 7, 6, 34), material);
      const z = -34 + i * 10; const y0 = cy(topo + ch / 2);
      corpo.position.set(cx(f.x + f.w / 2), y0, z); corpo.castShadow = true; corpo.receiveShadow = true; add(corpo);
      const lw = cw - 52; const lh = 30;
      const rotulo = new Mesh(new PlaneGeometry(lw, lh), new MeshBasicMaterial({ map: texturaRotulo(c, lw, lh), transparent: true, side: DoubleSide, toneMapped: false }));
      rotulo.position.set(corpo.position.x, cy(topo + 22), z + 3.8); add(rotulo);
      cartoes3d.push({ corpo, rotulo, y0, atraso: 0.1 + (cartoes.length - 1 - i) * 0.12 });
    });

    // peça da frente, com espessura e quina arredondada
    const shape = contornoFrente(f.w, f.h, raio, fundo);
    const frente = new Mesh(new ExtrudeGeometry(shape, { depth: 16, bevelEnabled: true, bevelThickness: 10, bevelSize: 9, bevelSegments: 7, curveSegments: 56 }), couro);
    frente.position.set(cx(f.x + f.w / 2), cy(f.y + f.h / 2), -8);
    frente.castShadow = true; frente.receiveShadow = true; add(frente);

    // costura: pontos de ouro que acompanham o contorno, 17px para dentro
    const pts = shape.getSpacedPoints(Math.max(90, Math.floor((f.w + f.h) * 2 / 15)));
    const n = pts.length - 1;
    const costura = new InstancedMesh(new RoundedBoxGeometry(9, 2.6, 2.8, 2, 1.2), ouroFio, n);
    const aj = new Object3D();
    for (let i = 0; i < n; i++) {
      const p = pts[i]; const q = pts[(i + 1) % n]; const o = pts[(i + n - 1) % n];
      const tx = q.x - o.x; const ty = q.y - o.y; const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len; const ny = tx / len; // normal para dentro (contorno anti-horário)
      aj.position.set(p.x + nx * 17, p.y + ny * 17, 16 + 10 + 0.4);
      aj.rotation.set(0, 0, Math.atan2(ty, tx));
      aj.updateMatrix(); costura.setMatrixAt(i, aj.matrix);
    }
    costura.position.copy(frente.position); costura.position.z = frente.position.z; costura.castShadow = true; add(costura);

    sol.position.set(-300, 360, 560); sol.target.position.set(0, -30, 0);
    const a = Math.max(l.largura, l.altura) * 0.75;
    Object.assign(sol.shadow.camera, { left: -a, right: a, top: a, bottom: -a, near: 10, far: 2600 }); sol.shadow.camera.updateProjectionMatrix();
    chave = JSON.stringify([l.largura, l.altura, f, l.faixa, cartoes.map((c) => c.rotulo + c.valor + c.cor)]);
  };

  const desenhar = (dt: number) => {
    if (!atual) return;
    entrada = Math.min(1, entrada + dt / 1.2);
    abertaT += ((aberta ? 1 : 0) - abertaT) * Math.min(1, dt * 7);
    rx += (alvoRx - rx) * Math.min(1, dt * 6); ry += (alvoRy - ry) * Math.min(1, dt * 6);
    const t = performance.now() / 1000;
    grupo.rotation.x = rx + (reduz ? 0 : Math.sin(t * 0.8) * 0.008);
    grupo.rotation.y = ry + (reduz ? 0 : Math.cos(t * 0.6) * 0.012);
    const ease = (v: number) => 1 - (1 - v) ** 3;
    cartoes3d.forEach((c, i) => {
      const e1 = ease(Math.max(0, Math.min(1, (entrada - c.atraso) / 0.7)));
      c.corpo.position.y = c.y0 - (1 - e1) * 140 + abertaT * (26 + i * 12);
      c.rotulo.position.y = c.corpo.position.y + 115 - 22;
      c.corpo.visible = c.rotulo.visible = e1 > 0.001;
      (c.rotulo.material as MeshBasicMaterial).opacity = e1;
    });
    renderer.render(cena, camera);
  };
  const ciclo = () => {
    if (parar) return;
    const agora = performance.now(); const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
    if (visivel && document.visibilityState === 'visible') desenhar(dt);
    raf = requestAnimationFrame(ciclo);
  };
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((it) => { visivel = it[0]?.isIntersecting ?? true; }) : null;
  io?.observe(host);

  return {
    atualizar(l, cartoes, ab) {
      aberta = ab;
      const nova = JSON.stringify([l.largura, l.altura, l.frente, l.faixa, cartoes.map((c) => c.rotulo + c.valor + c.cor)]);
      if (nova !== chave) { montar(l, cartoes); if (reduz) { entrada = 1; desenhar(0.016); } }
      if (!raf && !reduz) { ultimo = performance.now(); raf = requestAnimationFrame(ciclo); }
    },
    inclinar(px, py) { if (!reduz) { alvoRy = (px - 0.5) * 0.2; alvoRx = (0.5 - py) * 0.12; } },
    destruir() {
      parar = true; cancelAnimationFrame(raf); io?.disconnect(); limpar();
      couro.dispose(); forro.dispose(); ouroFio.dispose(); bump.dispose(); cor.dispose(); ambiente.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
