import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createClient} from '@libsql/client';
process.loadEnvFile('.env.local');
const base='https://royz-ai-consulting.vercel.app';
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
let id;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const home=await page.goto(base,{waitUntil:'networkidle'});assert.equal(home.status(),200);assert.ok((await page.title()).includes('Royz'));
 await page.screenshot({path:'/tmp/royz-ai-production-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/royz-ai-production-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const payload={name:'QA Production',email:'qa-royz@example.com',business:'QA Production smoke — delete',website:'',industry:'Home services',teamSize:'2–5 people',painPoint:'quotes',hoursPerWeek:8,tools:'Spreadsheet',details:'QA production verification of a quote preparation workflow with owner approval.',consent:true,company:''};
 const result=await page.request.post(base+'/api/assessments',{headers:{origin:base},data:payload});assert.equal(result.status(),201,await result.text());const saved=await result.json();id=saved.id;
 const client=await page.request.get(base+'/api/client?token='+saved.token);assert.equal(client.status(),200);const data=await client.json();assert.equal(data.assessment.business,payload.business);assert.equal(data.billing.ready,true);assert.equal(data.assessment.notes,undefined);
 await page.goto(base+'/client/'+saved.token);await page.getByRole('heading',{name:'A quote preparation workflow'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal((await page.request.get(base+'/api/studio')).status(),401);
 assert.equal((await page.request.post(base+'/api/stripe/webhook',{data:{}})).status(),400);
 assert.deepEqual(errors,[]);
 const cal=await page.goto('https://cal.com/ian-royes-lpueeg/secret',{waitUntil:'domcontentloaded'});await page.waitForTimeout(2000);const calendarText=await page.locator('body').innerText();
 console.log(JSON.stringify({publicSite:200,intakePersisted:true,privatePlanLoads:true,unauthorizedStudio:401,unsignedWebhook:400,billingReady:true,mobileOverflow:false,pageErrors:errors,calendarStatus:cal.status(),calendarTitle:await page.title(),calendarFound:/Consultation Meeting|Ian Royes/.test(calendarText)}));
}finally{if(id)await db.execute({sql:'DELETE FROM rmg_ai_assessments WHERE id=? AND email=?',args:[id,'qa-royz@example.com']});await browser.close();db.close();}
