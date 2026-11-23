// A carteira em 3D de verdade (three.js): couro com relevo, costura dourada em relevo, cartões de metal com reflexo,
// luz e sombra suaves. Carrega só quando a tela do Início abre (o resto do app não paga por isso).
// A unidade da cena é o PIXEL do CSS, com a câmera ajustada para o plano z=0 bater 1:1 com a tela: assim o texto em HTML
// (saldo, botões) fica exatamente em cima da frente da carteira.

import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, Color, DirectionalLight, DoubleSide, Group, InstancedMesh, MathUtils, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, RepeatWrapping, Scene, SRGBColorSpace, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface CartaoCena { rotulo: string; valor: string; tom: 'ouro' | 'onix' | 'vinho' }
export interface LayoutCena { largura: number; altura: number; bolsa: { x: number; y: number; w: number; h: number }; cartoes: { x: number; w: number; topo: number[] } }
export interface CenaCarteira {
  atualizar(layout: LayoutCena, cartoes: CartaoCena[], aberta: boolean): void;
  inclinar(px: number, py: number): void;
  destruir(): void;
}

const FOLGA_CARTAO = 210; // quanto do cartão fica escondido atrás da frente

export function webglDisponivel(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** Relevo de couro: pontinhos irregulares e rugas finas, desenhados num canvas e usados como bumpMap. */
function texturaCouro(): { bump: CanvasTexture; cor: CanvasTexture } {
  const T = 512;
  const b = document.createElement('canvas'); b.width = b.height = T;
  const c = document.createElement('canvas'); c.width = c.height = T;
  const bx = b.getContext('2d')!; const cx = c.getContext('2d')!;
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, T, T);
  cx.fillStyle = '#2c1b0f'; cx.fillRect(0, 0, T, T);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * T; const y = rnd() * T; const r = 1.4 + rnd() * 3.2; const v = Math.floor(70 + rnd() * 120);
    bx.fillStyle = `rgba(${v},${v},${v},.55)`;
    bx.beginPath(); bx.arc(x, y, r, 0, Math.PI * 2); bx.fill();
    const tom = 36 + Math.floor(rnd() * 30);
    cx.fillStyle = `rgba(${tom + 14},${tom},${tom - 14},.35)`;
    cx.beginPath(); cx.arc(x, y, r * 1.3, 0, Math.PI * 2); cx.fill();
  }
  bx.strokeStyle = 'rgba(40,40,40,.35)'; bx.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * T; const y = rnd() * T; const a = rnd() * Math.PI * 2; const l = 14 + rnd() * 34;
    bx.beginPath(); bx.moveTo(x, y); bx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); bx.stroke();
  }
  const mk = (cv: HTMLCanvasElement, cor: boolean) => {
    const t = new CanvasTexture(cv);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(3, 2);
    t.anisotropy = 4;
    if (cor) t.colorSpace = SRGBColorSpace;
    return t;
  };
  return { bump: mk(b, false), cor: mk(c, true) };
}

function texturaRotulo(c: CartaoCena, w: number, h: number): CanvasTexture {
  const k = 2;
  const cv = document.createElement('canvas'); cv.width = w * k; cv.height = h * k;
  const x = cv.getContext('2d')!;
  x.scale(k, k);
  x.fillStyle = c.tom === 'ouro' ? '#3B2A0A' : c.tom === 'onix' ? '#EBDDB4' : '#F8DCE2';
  x.font = '700 21px "Manrope", "Inter", system-ui, sans-serif';
  x.textBaseline = 'middle';
  x.textAlign = 'left';
  x.fillText(c.rotulo.length > 22 ? `${c.rotulo.slice(0, 21)}…` : c.rotulo, 0, h / 2);
  x.textAlign = 'right';
  x.globalAlpha = 0.92;
  x.fillText(c.valor, w, h / 2);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function materialDoCartao(tom: CartaoCena['tom']): MeshPhysicalMaterial {
  if (tom === 'ouro') return new MeshPhysicalMaterial({ color: new Color('#C99B3F'), metalness: 1, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.1 });
  if (tom === 'onix') return new MeshPhysicalMaterial({ color: new Color('#0f0e0d'), metalness: 0.5, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 });
  return new MeshPhysicalMaterial({ color: new Color('#4C0F22'), metalness: 0.2, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.8 });
}

export function criarCena(host: HTMLElement): CenaCarteira {
  const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'cl-3d-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const cena = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environment = ambiente;
  cena.environmentIntensity = 0.55;
  cena.add(new AmbientLight(0xffffff, 0.12));
  const sol = new DirectionalLight(0xfff0d0, 1.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.bias = -0.0004;
  sol.shadow.radius = 6;
  cena.add(sol, sol.target);
  const contraluz = new DirectionalLight(0xe8c77a, 0.9);
  contraluz.position.set(-300, 200, -200);
  cena.add(contraluz);

  const camera = new PerspectiveCamera(20, 1, 10, 6000);
  const grupo = new Group();
  cena.add(grupo);
  const { bump, cor } = texturaCouro();
  const couro = new MeshPhysicalMaterial({ color: new Color('#4a2f1a'), map: cor, bumpMap: bump, bumpScale: 2.6, roughness: 0.62, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.55, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new Color('#9a6f35'), envMapIntensity: 0.8 });
  const ouroFio = new MeshStandardMaterial({ color: new Color('#E3BE6A'), metalness: 1, roughness: 0.32, envMapIntensity: 1.3 });

  let frente: Mesh | null = null;
  let costura: InstancedMesh | null = null;
  const cartaoMeshes: { corpo: Mesh; rotulo: Mesh; destinoY: number; y: number; atraso: number }[] = [];
  let layoutAtual: LayoutCena | null = null;
  let aberta = false;
  let aberturaT = 0;
  let entrada = reduz ? 1 : 0;
  let alvoRx = 0; let alvoRy = 0; let rx = 0; let ry = 0;
  let parar = false;
  let visivel = true;
  let ultimo = performance.now();
  let raf = 0;
  const liberar: (() => void)[] = [];

  const limpar = () => {
    for (const o of [frente, costura, ...cartaoMeshes.flatMap((c) => [c.corpo, c.rotulo])]) {
      if (!o) continue;
      grupo.remove(o);
      o.geometry.dispose();
      const m = o.material as MeshBasicMaterial;
      if ((m as MeshBasicMaterial).map && o !== frente) (m as MeshBasicMaterial).map?.dispose();
      if (o !== frente && o !== costura) m.dispose();
    }
    cartaoMeshes.length = 0;
    frente = null; costura = null;
  };

  const montar = (l: LayoutCena, cartoes: CartaoCena[]) => {
    limpar();
    layoutAtual = l;
    renderer.setSize(l.largura, l.altura, false);
    renderer.domElement.style.width = `${l.largura}px`;
    renderer.domElement.style.height = `${l.altura}px`;
    camera.aspect = l.largura / l.altura;
    camera.position.set(0, 0, (l.altura / 2) / Math.tan(MathUtils.degToRad(camera.fov / 2)));
    camera.far = camera.position.z * 3;
    camera.updateProjectionMatrix();
    // coordenadas da cena: origem no centro do contêiner, y para cima
    const cx = (px: number) => px - l.largura / 2;
    const cy = (py: number) => l.altura / 2 - py;

    const { bolsa } = l;
    const prof = 24;
    const raio = Math.min(40, bolsa.h / 4);
    frente = new Mesh(new RoundedBoxGeometry(bolsa.w, bolsa.h, prof, 8, raio), couro);
    frente.position.set(cx(bolsa.x + bolsa.w / 2), cy(bolsa.y + bolsa.h / 2), 0);
    frente.castShadow = true; frente.receiveShadow = true;
    grupo.add(frente);

    // costura: pequenas peças de ouro ao longo de um retângulo arredondado, um pouco para dentro
    const inset = 15; const w = bolsa.w - inset * 2; const h = bolsa.h - inset * 2; const r = Math.max(8, raio - inset);
    const pontos: { x: number; y: number; a: number }[] = [];
    const passo = 15;
    const trechos: [number, number, number, number, number, number][] = [ // x0,y0,x1,y1 (reta) e centro para arcos tratados à parte
      [-w / 2 + r, h / 2, w / 2 - r, h / 2, 0, 0], [w / 2, h / 2 - r, w / 2, -h / 2 + r, 0, 0], [w / 2 - r, -h / 2, -w / 2 + r, -h / 2, 0, 0], [-w / 2, -h / 2 + r, -w / 2, h / 2 - r, 0, 0],
    ];
    for (const [x0, y0, x1, y1] of trechos) {
      const len = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.floor(len / passo)); const a = Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i <= n; i++) pontos.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, a });
    }
    const cantos: [number, number, number][] = [[w / 2 - r, h / 2 - r, 0], [w / 2 - r, -h / 2 + r, -Math.PI / 2], [-w / 2 + r, -h / 2 + r, -Math.PI], [-w / 2 + r, h / 2 - r, Math.PI / 2]];
    for (const [ox, oy, a0] of cantos) {
      const arco = (Math.PI / 2) * r; const n = Math.max(4, Math.floor(arco / 8));
      for (let i = 1; i < n; i++) { const a = a0 + ((Math.PI / 2) * i) / n; pontos.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r, a: a - Math.PI / 2 }); }
    }
    costura = new InstancedMesh(new RoundedBoxGeometry(9, 2.6, 2.6, 2, 1.1), ouroFio, pontos.length);
    const ajudante = new Object3D();
    pontos.forEach((p, i) => {
      ajudante.position.set(p.x, p.y, prof / 2 + 0.6);
      ajudante.rotation.set(0, 0, p.a);
      ajudante.updateMatrix();
      costura!.setMatrixAt(i, ajudante.matrix);
    });
    costura.castShadow = true;
    costura.position.copy(frente.position);
    grupo.add(costura);

    // cartões por trás: só uma faixa de cada aparece acima da frente
    const total = cartoes.length;
    cartoes.forEach((c, i) => {
      const topo = l.cartoes.topo[i] ?? i * 42;
      const cw = l.cartoes.w; const ch = FOLGA_CARTAO;
      const corpo = new Mesh(new RoundedBoxGeometry(cw, ch, 7, 6, 30), materialDoCartao(c.tom));
      const z = -34 + i * 9;
      const yFinal = cy(topo + ch / 2);
      corpo.position.set(cx(l.cartoes.x + cw / 2), yFinal, z);
      corpo.castShadow = true; corpo.receiveShadow = true;
      grupo.add(corpo);
      const lw = cw - 44; const lh = 30;
      const rotulo = new Mesh(new PlaneGeometry(lw, lh), new MeshBasicMaterial({ map: texturaRotulo(c, lw, lh), transparent: true, side: DoubleSide, toneMapped: false }));
      rotulo.position.set(corpo.position.x, cy(topo + 21), z + 3.8);
      grupo.add(rotulo);
      cartaoMeshes.push({ corpo, rotulo, destinoY: yFinal, y: yFinal, atraso: 0.08 + (total - 1 - i) * 0.1 });
    });

    sol.position.set(-260, 340, 520);
    sol.target.position.set(0, -20, 0);
    const alc = Math.max(l.largura, l.altura) * 0.7;
    Object.assign(sol.shadow.camera, { left: -alc, right: alc, top: alc, bottom: -alc, near: 10, far: 2400 });
    sol.shadow.camera.updateProjectionMatrix();
  };

  const desenhar = (dt: number) => {
    if (!layoutAtual) return;
    entrada = Math.min(1, entrada + dt / 1.1);
    aberturaT += ((aberta ? 1 : 0) - aberturaT) * Math.min(1, dt * 7);
    rx += (alvoRx - rx) * Math.min(1, dt * 6);
    ry += (alvoRy - ry) * Math.min(1, dt * 6);
    const t = performance.now() / 1000;
    const flutua = reduz ? 0 : Math.sin(t * 0.9) * 0.012;
    grupo.rotation.x = rx + flutua;
    grupo.rotation.y = ry + (reduz ? 0 : Math.cos(t * 0.7) * 0.014);
    const ease = (v: number) => 1 - (1 - v) ** 3;
    if (frente) {
      const e0 = ease(Math.min(1, entrada * 1.6));
      frente.position.z = 0; costura!.position.z = 0;
      grupo.position.y = (1 - e0) * -30;
    }
    cartaoMeshes.forEach((c, i) => {
      const e1 = ease(Math.max(0, Math.min(1, (entrada - c.atraso) / 0.7)));
      const subida = aberturaT * (22 + i * 10);
      c.corpo.position.y = c.destinoY + (1 - e1) * -150 + subida;
      c.rotulo.position.y = c.corpo.position.y + (layoutAtual!.cartoes.topo[i] !== undefined ? 0 : 0) + (FOLGA_CARTAO / 2 - 21);
      c.corpo.visible = c.rotulo.visible = e1 > 0.001;
      (c.rotulo.material as MeshBasicMaterial).opacity = e1;
    });
    renderer.render(cena, camera);
  };

  const ciclo = () => {
    if (parar) return;
    const agora = performance.now();
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    if (visivel && document.visibilityState === 'visible') desenhar(dt);
    raf = requestAnimationFrame(ciclo);
  };

  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((it) => { visivel = it[0]?.isIntersecting ?? true; }) : null;
  io?.observe(host);
  liberar.push(() => io?.disconnect());

  return {
    atualizar(l, cartoes, ab) {
      const mudou = !layoutAtual || l.largura !== layoutAtual.largura || l.altura !== layoutAtual.altura || l.bolsa.h !== layoutAtual.bolsa.h || l.bolsa.y !== layoutAtual.bolsa.y || cartoes.length !== cartaoMeshes.length || cartoes.some((c, i) => `${c.rotulo}|${c.valor}|${c.tom}` !== (cartaoMeshes[i] ? cartaoMeshes[i].rotulo.userData.k : ''));
      aberta = ab;
      if (mudou) {
        montar(l, cartoes);
        cartaoMeshes.forEach((c, i) => { c.rotulo.userData.k = `${cartoes[i].rotulo}|${cartoes[i].valor}|${cartoes[i].tom}`; });
        if (reduz) entrada = 1;
        if (!raf) { ultimo = performance.now(); raf = requestAnimationFrame(ciclo); }
        if (reduz) desenhar(0.016);
      }
    },
    inclinar(px, py) { if (!reduz) { alvoRy = (px - 0.5) * 0.22; alvoRx = (0.5 - py) * 0.14; } },
    destruir() {
      parar = true;
      cancelAnimationFrame(raf);
      liberar.forEach((f) => f());
      limpar();
      couro.dispose(); ouroFio.dispose(); bump.dispose(); cor.dispose(); ambiente.dispose(); pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
