import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const folder='docs/creative/private-concepts';
const concepts=[
 {file:'novaro-espresso.png',title:'The espresso ritual',copy:'A taste-led direction built around the product page’s dark chocolate, brown sugar and molasses notes.'},
 {file:'novaro-latte.png',title:'The milk moment',copy:'A latte-focused direction based on the product page’s description of the blend in milk drinks.'},
 {file:'novaro-versatility.png',title:'One blend, two routines',copy:'A brewing-method direction based on the stated espresso and French-press uses.'}
];
for(const c of concepts)c.src='data:image/png;base64,'+(await fs.readFile(`${folder}/${c.file}`)).toString('base64');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1560,height:1060},deviceScaleFactor:1});
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>NOVARO private concept review · Royz Creative</title><style>*{box-sizing:border-box}body{margin:0;padding:42px 50px;background:#f7f3ec;color:#24211d;font-family:Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:end;margin-bottom:24px;border-bottom:1px solid #d7cdbf;padding-bottom:20px}h1{font:48px Georgia,serif;margin:0}header p{font-size:13px;color:#776c60}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.item img{width:100%;height:620px;object-fit:contain;background:#eae1d3}.item h2{font-size:20px;margin:17px 0 8px}.item p{font-size:14px;line-height:1.6;color:#62584c}footer{margin-top:24px;padding-top:18px;border-top:1px solid #d7cdbf;font-size:13px;line-height:1.6}footer strong{color:#9c482f}</style><header><div><p>ROYZ CREATIVE / PRIVATE REVIEW</p><h1>Three ways to introduce Second Chance.</h1></div><p>Prepared for NOVARO · September 23, 2026</p></header><div class="grid">${concepts.map(c=>`<div class="item"><img src="${c.src}" alt="${c.title}"><h2>${c.title}</h2><p>${c.copy}</p></div>`).join('')}</div><footer><strong>Speculative, AI-assisted concepts. Not commissioned. Not approved for advertising.</strong><br>Small packaging text is illustrative and must be replaced or checked against original brand assets before production. No campaign results are claimed.<br>Proposed pilot: one SKU, three approved concepts, six PNG exports, one revision round · $350 once · three business days after scope, payment and complete assets.</footer></html>`;
 await fs.writeFile(`${folder}/novaro-review.html`,html);await page.setContent(html);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
 await page.screenshot({path:`${folder}/novaro-review.jpg`,type:'jpeg',quality:72,fullPage:true});
 await page.pdf({path:`${folder}/novaro-review.pdf`,width:'1560px',height:'1110px',printBackground:true});
 console.log(JSON.stringify({preview:`${folder}/novaro-review.jpg`,bytes:(await fs.stat(`${folder}/novaro-review.jpg`)).size}));
}finally{await browser.close()}
