import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {request} from '@playwright/test';
import {createClient} from '@libsql/client';

// Run manually after deployment. Creates and deletes one explicitly marked demo job.
// No Stripe requests, purchases, provider calls, or mutations to other projects.
process.loadEnvFile('.env.local');
for(const name of ['ADMIN_PASSWORD','TURSO_DATABASE_URL','TURSO_AUTH_TOKEN'])assert.ok(process.env[name],`${name} must be configured`);
const base='https://royz-ai-consulting.vercel.app';
const email='qa-creative-assets@example.com';
const brand='QA asset delivery — synthetic demo — delete';
const headers={origin:base};
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const owner=await request.newContext({baseURL:base});
const guest=await request.newContext({baseURL:base});
const report={checkedAt:new Date().toISOString(),site:base+'/creative',checks:[],charged:false,cleanup:false};
let id;
const fixtures=[];
async function expectJSON(response,status,label){assert.equal(response.status(),status,`${label}: expected ${status}, received ${response.status()}`);return response.json();}
async function patch(action,values={}){return (await expectJSON(await owner.patch('/api/creative/studio',{headers,data:{id,action,...values}}),200,action)).job;}
async function assertPNG(response,expected,label){assert.equal(response.status(),200,label);assert.match(response.headers()['content-type']||'',/^image\/png/);assert.match(response.headers()['cache-control']||'',/no-store/);assert.deepEqual(await response.body(),expected,`${label}: exact original bytes`);}
try{
 for(const [index,name] of ['morning-ritual','product-focus','slow-moment'].entries()){
  for(const format of ['square','portrait']){
   const bytes=await fs.readFile(`public/creative/sample-pack/daybreak-${name}-${format}.png`);
   assert.ok(bytes.length<=3500000,'Fixture must fit the upload limit');
   fixtures.push({concept:index+1,format,bytes,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }
 assert.equal(new Set(fixtures.map(f=>f.sha256)).size,6,'Fixtures must be distinct');
 assert.equal((await guest.get('/api/creative/studio')).status(),401,'Guest cannot access owner studio');
 await expectJSON(await owner.post('/api/auth',{headers,data:{password:process.env.ADMIN_PASSWORD}}),200,'Owner login');
 const created=await expectJSON(await owner.post('/api/creative/studio',{headers,data:{name:'QA asset delivery',email,brand,brief:'Synthetic demo for production private asset delivery verification. Three static specialty coffee concepts, each exported square and portrait. Not a client, order, or purchase.',references:[base+'/creative/demo-coffee.png'],rightsConfirmed:true,demo:true}}),201,'Create isolated demo');
 let job=created.job;id=job.id;
 assert.ok(id);assert.equal(job.email,email);assert.equal(job.demo,true);assert.equal(job.billing,undefined);
 job=await patch('update',{analysis:{...job.analysis,missingAssets:[],rightsFlags:[],decision:'accept'}});
 job=await patch('approve');assert.equal(job.scopeApproved,true);
 report.checks.push('Authenticated owner created and approved one synthetic demo without billing');
 for(const fixture of fixtures){
  const uploaded=await expectJSON(await owner.post(`/api/creative/assets?jobId=${id}&concept=${fixture.concept}`,{headers:{...headers,'content-type':'image/png'},data:fixture.bytes}),201,'Private PNG upload');
  job=uploaded.job;const output=uploaded.output;
  assert.equal(output.storage,'private-db');assert.equal(output.sha256,fixture.sha256);assert.equal(output.bytes,fixture.bytes.length);
  assert.equal(output.width,1080);assert.equal(output.height,fixture.format==='square'?1080:1350);assert.equal(output.concept,fixture.concept);
  for(const flag of ['brandApproved','textApproved','rightsApproved','humanApproved'])assert.equal(output[flag],false,'New output must require review');
  const url=new URL(output.url,base);assert.equal(url.origin,base);assert.equal(url.searchParams.get('token'),job.token);
  fixture.output=output;
  await assertPNG(await owner.get(url.pathname),fixture.bytes,'Owner preview before delivery');
  assert.equal((await guest.get(output.url)).status(),404,'Client token cannot read undelivered asset');
  assert.equal((await guest.get(url.pathname)).status(),404,'Anonymous request cannot read private asset');
 }
 assert.equal(job.outputs.length,6);
 let portal=await expectJSON(await guest.get(`/api/creative/client?token=${job.token}`),200,'Client portal before delivery');assert.equal(portal.job.outputs.length,0);
 report.checks.push('Six real PNGs persisted with verified hashes, dimensions, private owner previews, and exact byte equality');
 report.checks.push('Guest access denied before delivery, including requests with the valid project token');
 job=await patch('update',{outputs:job.outputs.map(output=>({...output,brandApproved:true,textApproved:true,rightsApproved:true,humanApproved:true}))});
 job=await patch('qa');assert.equal(job.stage,'qa');assert.equal(job.qa.passed,true);
 job=await patch('deliver');assert.equal(job.stage,'delivered');assert.equal(job.billing,undefined);
 portal=await expectJSON(await guest.get(`/api/creative/client?token=${job.token}`),200,'Delivered client portal');assert.equal(portal.job.outputs.length,6);
 for(const fixture of fixtures){
  const output=portal.job.outputs.find(o=>o.concept===fixture.concept&&o.height===(fixture.format==='square'?1080:1350));assert.ok(output,'Portal contains expected delivered format');
  await assertPNG(await guest.get(output.url),fixture.bytes,'Client download after delivery');
  const wrong=new URL(output.url,base);wrong.searchParams.set('token','0'.repeat(64));
  assert.equal((await guest.get(wrong.pathname+wrong.search)).status(),404,'Wrong token denied after delivery');
  assert.equal((await guest.get(wrong.pathname)).status(),404,'Missing token denied after delivery');
 }
 report.checks.push('All four human approval flags, QA, and final delivery gate completed');
 report.checks.push('Delivered client downloads match source bytes, use no-store, and reject missing or incorrect tokens');
}finally{
 try{
  if(id){
   // Every delete is restricted to this newly created ID, synthetic email and demo flag.
   const owned="SELECT id FROM rmg_creative_jobs WHERE id=? AND json_extract(data,'$.email')=? AND json_extract(data,'$.demo')=1";
   await db.batch([
    {sql:`DELETE FROM rmg_creative_assets WHERE job_id IN (${owned})`,args:[id,email]},
    {sql:`DELETE FROM rmg_creative_audit WHERE job_id IN (${owned})`,args:[id,email]},
    {sql:"DELETE FROM rmg_creative_jobs WHERE id=? AND json_extract(data,'$.email')=? AND json_extract(data,'$.demo')=1",args:[id,email]},
   ],'write');
   for(const [table,column] of [['rmg_creative_assets','job_id'],['rmg_creative_audit','job_id'],['rmg_creative_jobs','id']]){
    const result=await db.execute({sql:`SELECT COUNT(*) AS remaining FROM ${table} WHERE ${column}=?`,args:[id]});
    assert.equal(Number(result.rows[0].remaining),0,`Synthetic records cleaned from ${table}`);
   }
   report.cleanup=true;
  }
 }finally{await owner.dispose();await guest.dispose();db.close();}
}
report.checks.push('Synthetic asset blobs, audit events, and job removed; no other projects changed');
await fs.mkdir('docs/creative',{recursive:true});
await fs.writeFile('docs/creative/production-assets-smoke.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
