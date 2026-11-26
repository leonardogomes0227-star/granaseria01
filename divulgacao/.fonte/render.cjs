const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch();
for(const v of ['a','b']){const p=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
 await p.goto('file:///home/user/granaseria01/divulgacao/.fonte/story.html?v='+v);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(700);
 await p.screenshot({path:`/home/user/granaseria01/divulgacao/story-${v==='a'?'1-descubra':'2-convite'}.png`});await p.close();}
await b.close();})();
