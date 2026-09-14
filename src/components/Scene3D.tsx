import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function makeTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function faceFrontTexture() {
  return makeTexture((ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,42,10,0.55)';
    ctx.lineWidth = s * 0.02;
    ctx.setLineDash([s * 0.012, s * 0.02]);
    ctx.beginPath();
    ctx.arc(c, c, c * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // zigurate gravado
    ctx.fillStyle = 'rgba(58,42,10,0.75)';
    const bw = s * 0.34;
    const bx = c - bw / 2;
    const steps = 4;
    const stepH = s * 0.045;
    for (let i = 0; i < steps; i++) {
      const w = bw - i * (bw / steps) * 0.7;
      const x = c - w / 2;
      const y = c + s * 0.12 - i * stepH;
      ctx.fillRect(x, y - stepH, w, stepH);
    }
    // disco solar
    ctx.beginPath();
    ctx.arc(c, c - s * 0.08, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  });
}

function faceBackTexture() {
  return makeTexture((ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,42,10,0.55)';
    ctx.lineWidth = s * 0.02;
    ctx.setLineDash([s * 0.012, s * 0.02]);
    ctx.beginPath();
    ctx.arc(c, c, c * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(58,42,10,0.8)';
    ctx.font = `700 ${s * 0.22}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('10%', c, c + s * 0.01);
  });
}

function buildCoin(): THREE.Group {
  const group = new THREE.Group();
  const radius = 1.5;
  const height = 0.26;

  const sideMat = new THREE.MeshStandardMaterial({ color: 0xa8851d, metalness: 0.9, roughness: 0.32 });
  const frontMat = new THREE.MeshStandardMaterial({ map: faceFrontTexture(), metalness: 0.55, roughness: 0.4 });
  const backMat = new THREE.MeshStandardMaterial({ map: faceBackTexture(), metalness: 0.55, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 72), [sideMat, frontMat, backMat]);
  group.add(body);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.995, height * 0.42, 16, 72),
    new THREE.MeshStandardMaterial({ color: 0xe0be4a, metalness: 1, roughness: 0.2 })
  );
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  return group;
}

function buildZiggurat(): THREE.Group {
  const group = new THREE.Group();
  // Tom sienna/bronze: contra um fundo claro, o marrom-oliva antigo virava uma mancha escura.
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, metalness: 0.08, roughness: 0.88 });
  const levels = 5;
  let width = 3.6;
  let y = 0;
  for (let i = 0; i < levels; i++) {
    const h = 0.34;
    const box = new THREE.Mesh(new THREE.BoxGeometry(width, h, width), mat);
    box.position.y = y + h / 2;
    group.add(box);
    y += h;
    width *= 0.72;
  }
  group.position.set(2.1, -1.55, -2.4);
  group.scale.setScalar(0.9);
  return group;
}

function buildParticles(): THREE.Points {
  const count = 260;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Partículas mais escuras que o dourado claro anterior: em fundo claro,
  // pontos dourados quase somem — aqui viram "poeira de bronze" visível.
  const material = new THREE.PointsMaterial({
    color: 0x8a5a12,
    size: 0.03,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}

export default function Scene3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    // Fundo transparente: deixa a textura clara (areia/pergaminho) do CSS aparecer atrás da cena.
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.3, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Luz recalibrada para fundo claro: menos "tocha no escuro", mais luz ambiente
    // suave batendo no metal, pra moeda continuar com relevo sem escurecer o resto.
    const hemi = new THREE.HemisphereLight(0xfff4d9, 0xcdb27a, 0.85);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff0cf, 1.15);
    key.position.set(3.5, 4.5, 4);
    scene.add(key);

    const torch = new THREE.PointLight(0xffb454, 0.55, 12, 2);
    torch.position.set(-2.5, 0.5, 3);
    scene.add(torch);

    const coin = buildCoin();
    coin.rotation.x = 0.08;
    scene.add(coin);

    const ziggurat = buildZiggurat();
    scene.add(ziggurat);

    const particles = buildParticles();
    scene.add(particles);

    let mouseX = 0;
    let mouseY = 0;
    function onMouseMove(e: MouseEvent) {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener('mousemove', onMouseMove);

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId: number;
    const clock = new THREE.Clock();

    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      coin.rotation.y += 0.0055;
      coin.position.y = Math.sin(t * 0.8) * 0.14;

      ziggurat.rotation.y = Math.sin(t * 0.1) * 0.05;

      particles.rotation.y += 0.0006;

      torch.intensity = 1.1 + Math.sin(t * 3.2) * 0.18 + Math.sin(t * 7) * 0.06;

      camera.position.x += (mouseX * 0.6 - camera.position.x) * 0.03;
      camera.position.y += (0.3 - mouseY * 0.35 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      resizeObserver.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => {
            if ('map' in m && m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
