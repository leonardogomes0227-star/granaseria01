// Renderiza os stories em 2x (2160×3840) e reduz para 1080×1920 com filtro Lanczos (mais nítido que renderizar direto em 1x).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const D = '/home/user/granaseria01/divulgacao/';
(async () => {
  const b = await chromium.launch();
  for (const [v, nome] of [['a', 'story-1-descubra'], ['b', 'story-2-convite']]) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
    await p.goto(`file://${D}.fonte/story.html?v=${v}`);
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${D}${nome}-2x.png` });
    await p.close();
    execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open('${D}${nome}-2x.png').convert('RGB')\nim.resize((1080,1920),Image.LANCZOS).save('${D}${nome}.png',optimize=True)\nim.save('${D}${nome}-2x.png',optimize=True)`]);
  }
  await b.close();
})();
