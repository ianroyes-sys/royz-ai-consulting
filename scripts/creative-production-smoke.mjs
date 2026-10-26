import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createClient} from '@libsql/client';
import Stripe from 'stripe';
process.loadEnvFile('.env.local');
const base='https://royz-ai-consulting.vercel.app';
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const browser=await chromium.launch({channel:'chrome',headless:true});
let id,sessionId;
const report={checkedAt:new Date().toISOString(),site:base+'/creative',checks:[],charged:false};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/creative','/creative/start','/creative/demo','/creative/terms','/creative/privacy','/creative/sample-pack.zip']){const r=route.endsWith('.zip')?await page.request.head(base+route):await page.request.get(base+route);assert.equal(r.status(),200,route)}
 await page.goto(base+'/creative',{waitUntil:'networkidle'});await page.screenshot({path:'docs/creative/screenshots/production-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'docs/creative/screenshots/production-mobile.png',fullPage:true});
 report.checks.push('Production pages, sample ZIP, desktop and mobile verified');
 assert.equal((await page.request.get(base+'/api/creative/studio')).status(),401);
 assert.equal((await page.request.post(base+'/api/stripe/webhook',{data:{}})).status(),400);
 const headers={origin:base};
 const intake=await page.request.post(base+'/api/creative/intake',{headers,data:{name:'QA Launch Verification',email:'qa-creative-launch@example.com',brand:'QA Creative launch verification — delete',brief:'Synthetic launch verification only. Three coffee image concepts in two sizes. Not a customer or a purchase.',references:[base+'/creative/demo-coffee.png'],rightsConfirmed:true}});assert.equal(intake.status(),201,await intake.text());const saved=await intake.json();const token=saved.token;
 let projection=(await(await page.request.get(base+'/api/creative/client?token='+token)).json()).job;id=projection.id;assert.equal(projection.canCheckout,false);assert.equal(projection.notes,undefined);assert.equal(projection.audit,undefined);
 const login=await page.request.post(base+'/api/auth',{headers,data:{password:process.env.ADMIN_PASSWORD}});assert.equal(login.status(),200);
 let j=(await(await page.request.get(base+'/api/creative/studio')).json()).jobs.find(j=>j.id===id);assert.ok(j);
 let response=await page.request.patch(base+'/api/creative/studio',{headers,data:{id,action:'update',analysis:{...j.analysis,missingAssets:[],rightsFlags:[],decision:'accept'}}});assert.equal(response.status(),200,await response.text());
 response=await page.request.patch(base+'/api/creative/studio',{headers,data:{id,action:'approve'}});assert.equal(response.status(),200,await response.text());
 projection=(await(await page.request.get(base+'/api/creative/client?token='+token)).json()).job;assert.equal(projection.canCheckout,true);
 response=await page.request.post(base+'/api/creative/checkout',{headers,data:{token,scopeHash:projection.scopeHash,consent:true}});assert.equal(response.status(),200,await response.text());const checkout=await response.json();assert.ok(checkout.url.startsWith('https://checkout.stripe.com/'));
 j=(await(await page.request.get(base+'/api/creative/studio')).json()).jobs.find(j=>j.id===id);sessionId=j.billing.sessionId;let session=await stripe.checkout.sessions.retrieve(sessionId);assert.equal(session.mode,'payment');assert.equal(session.amount_total,35000);assert.equal(session.currency,'usd');assert.equal(session.livemode,true);assert.equal(session.payment_status,'unpaid');assert.equal(session.status,'open');
 const repeat=await page.request.post(base+'/api/creative/checkout',{headers,data:{token,scopeHash:projection.scopeHash,consent:true}});assert.equal(repeat.status(),200);assert.equal((await repeat.json()).url,checkout.url);
 report.checks.push('Persistent intake, private scope, owner approval and live $350 one-time checkout verified; repeated checkout reused session');
 response=await page.request.post(base+'/api/creative/checkout/abandon',{headers,data:{token}});assert.equal(response.status(),200,await response.text());session=await stripe.checkout.sessions.retrieve(sessionId);assert.equal(session.status,'expired');projection=(await(await page.request.get(base+'/api/creative/client?token='+token)).json()).job;assert.equal(projection.billingStatus,'unpaid');assert.equal(projection.scopeApproved,false);
 report.checks.push('Unpaid test checkout expired and project unlocked; no payment made');
 assert.deepEqual(errors,[]);report.checks.push('Owner authentication and unsigned webhook rejection verified; no browser errors');
 await fs.writeFile('docs/creative/production-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
 if(sessionId){const s=await stripe.checkout.sessions.retrieve(sessionId);if(s.status==='open')await stripe.checkout.sessions.expire(sessionId)}
 if(id){await db.batch([{sql:'DELETE FROM rmg_creative_audit WHERE job_id=?',args:[id]},{sql:"DELETE FROM rmg_creative_jobs WHERE id=? AND json_extract(data,'$.email')='qa-creative-launch@example.com'",args:[id]}],'write')}
 await browser.close();db.close();
}
