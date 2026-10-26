import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Original editable layout designs around a generated fictional product photograph.
// This does not regenerate or retouch the source product image.
const dir=path.resolve('public/creative/sample-pack');
await fs.mkdir(dir,{recursive:true});
await fs.copyFile('public/creative/demo-coffee.png',path.join(dir,'demo-coffee.png')); 
const image=await fs.readFile('public/creative/demo-coffee.png');
const src='data:image/png;base64,'+image.toString('base64');
const concepts=[
 {id:'morning-ritual',label:'Ritual angle',headline:'Make room<br>for morning.',sub:'FIRST LIGHT / WHOLE BEAN COFFEE',cta:'Meet your morning ritual',style:0},
 {id:'product-focus',label:'Product angle',headline:'A little<br>daybreak.<br>Every day.',sub:'FIRST LIGHT · 250g · WHOLE BEAN',cta:'Discover First Light',style:1},
 {id:'slow-moment',label:'Occasion angle',headline:'Before the<br>day gets loud.',sub:'COFFEE. A CUP. A MOMENT.',cta:'Start with First Light',style:2},
];
function html(c,w,h){return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Daybreak — ${c.label} — fictional concept</title><style>
*{box-sizing:border-box}body{margin:0}main{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:#f5e7d6;color:#15305c;font-family:Arial,Helvetica,sans-serif}.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.shade{position:absolute;inset:0;background:linear-gradient(180deg,#fcf0dfd9 0%,transparent 54%)}.brand{position:absolute;top:52px;left:62px;font-size:23px;letter-spacing:8px}.brand small{display:block;font-size:10px;letter-spacing:4px;margin-top:9px}h1{position:absolute;left:58px;top:112px;margin:0;font:normal ${h>1100?'102':'90'}px/.98 Georgia,serif;letter-spacing:-4px;max-width:850px}.sub{position:absolute;left:64px;top:${h>1100?'358':'340'}px;font-size:13px;letter-spacing:2.4px;font-weight:600}.cta{position:absolute;left:62px;bottom:98px;background:#163464;color:white;padding:20px 25px;border-radius:30px;font-size:16px}.foot{position:absolute;bottom:0;left:0;right:0;background:#15305c;color:white;display:flex;justify-content:space-between;gap:20px;padding:18px 32px;font-size:10px;letter-spacing:1.8px}.foot span:last-child{white-space:nowrap}
.s1{background:#163464;color:#f5e7d6}.s1 .photo{inset:47% 0 48px auto;width:72%;height:calc(53% - 48px);object-fit:cover;border-radius:230px 0 0 0}.s1 .shade{display:none}.s1 h1{top:154px;z-index:2;font-size:${h>1100?'120':'104'}px;text-shadow:0 2px 30px #15305c22}.s1 .sub{top:auto;bottom:186px;z-index:3;background:#163464;padding:12px 16px;left:46px;font-size:12px}.s1 .cta{background:#f5e7d6;color:#163464;z-index:3}.s1 .foot{background:#102543}
.s2{background:#efe7dc}.s2 .photo{top:auto;bottom:48px;height:66%;object-fit:cover;object-position:center 58%}.s2 .shade{display:none}.s2 .brand{font-size:20px}.s2 h1{top:138px;font-size:${h>1100?'110':'95'}px;line-height:.95}.s2 .sub{top:${h>1100?'375':'340'}px}.s2 .cta{left:auto;right:45px;bottom:83px}.s2 .foot{background:#e8ddcd;color:#15305c}
</style><main class="s${c.style}"><img class="photo" src="${src}" alt="AI-generated fictional Daybreak coffee bag and espresso cup"><div class="shade"></div><div class="brand">DAYBREAK<small>COFFEE STUDIO</small></div><h1>${c.headline}</h1><div class="sub">${c.sub}</div><div class="cta">${c.cta} ↗</div><div class="foot"><span>SPEC CONCEPT · FICTIONAL BRAND · NOT CLIENT WORK</span><span>ROYZ CREATIVE</span></div></main></html>`}
const browser=await chromium.launch({channel:'chrome',headless:true});
const manifest=[];
try{
 for(const c of concepts)for(const [format,w,h] of [['square',1080,1080],['portrait',1080,1350]]){
  const stem=`daybreak-${c.id}-${format}`;
  const markup=html(c,w,h);await fs.writeFile(path.join(dir,stem+'.html'),markup.replace(src,'demo-coffee.png'));
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await page.setContent(markup);await page.locator('img').evaluate(img=>img.decode());
  await page.screenshot({path:path.join(dir,stem+'.png')});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);
  if(overflow)throw new Error(`Unexpected overflow ${stem}`);
  manifest.push({file:stem+'.png',source:stem+'.html',width:w,height:h,concept:c.label,qa:'dimensions and text rendered; visual review required',fictional:true});await page.close();
 }
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({brand:'Daybreak Coffee Studio — fictional',createdAt:new Date().toISOString(),clientWork:false,performanceData:null,sourceImage:'../demo-coffee.png',assets:manifest},null,2));
 console.log(JSON.stringify({exports:manifest.length,directory:dir,formats:['1080x1080','1080x1350'],clientWork:false}));
}finally{await browser.close()}
