import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCreativeWithOpenAI} from '../src/lib/creative-openai';

const input={name:'Private Owner',email:'private@example.com',brand:'Sample Coffee',brief:'Make three static concepts for our coffee bag with exact approved packaging.',references:['https://example.com/product.png'],rightsConfirmed:true};
const env={CREATIVE_OPENAI_ENABLED:'true',OPENAI_API_KEY:'test-never-real',OPENAI_CREATIVE_MODEL:'gpt-6-astra'};
const now=()=>Date.parse('2026-09-24T04:00:00Z');
const proposal={summary:'Coffee static sprint',deliverables:['Six PNG exports'],missingAssets:[],questionsForClient:[],brandConstraints:['Preserve package'],rightsFlags:[],technicalRisks:[],exactText:'',confidence:80,decision:'accept',reasons:['Requested scope appears consistent.']};
const complete=(text=JSON.stringify(proposal))=>({id:'resp_mock',status:'completed',error:null,output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text}]}],usage:{input_tokens:1000,output_tokens:500}});
function fake(value:unknown,status=200):typeof fetch{return async()=>new Response(JSON.stringify(value),{status});}

test('OpenAI analysis remains off by default, needs explicit model and budget, and rejects unpriced models before fetch',async()=>{
 let calls=0;const fetchImpl:typeof fetch=async()=>{calls++;throw new Error('must not reach network');};
 for(const configuration of [{},{...env,CREATIVE_OPENAI_ENABLED:'false'},{...env,OPENAI_API_KEY:''},{...env,OPENAI_CREATIVE_MODEL:''},{...env,OPENAI_CREATIVE_MODEL:'unverified-model'}])await assert.rejects(analyzeCreativeWithOpenAI(input,{maxSpendCents:100},{env:configuration,fetchImpl,now}));
 for(const maxSpendCents of [0,-1,1])await assert.rejects(analyzeCreativeWithOpenAI(input,{maxSpendCents},{env,fetchImpl,now}));
 await assert.rejects(analyzeCreativeWithOpenAI(input,{maxSpendCents:100},{env,fetchImpl,now:()=>Date.parse('2026-11-01')}));
 assert.equal(calls,0);
});

test('strict Responses request minimizes contact data, records provenance, and gates acceptance deterministically',async()=>{
 let sent:Record<string,unknown>|undefined;
 const fetchImpl:typeof fetch=async(url,init)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init?.redirect,'error');
  sent=JSON.parse(String(init?.body));const serialized=JSON.stringify(sent);
  assert.equal(serialized.includes(input.name),false);assert.equal(serialized.includes(input.email),false);
  assert.equal(serialized.includes('test-never-real'),false);
  const format=(sent!.text as {format:{strict:boolean;schema:{additionalProperties:boolean}}}).format;
  assert.equal(format.strict,true);assert.equal(format.schema.additionalProperties,false);
  assert.equal(sent!.store,false);assert.equal(sent!.tools,undefined);
  return new Response(JSON.stringify(complete()));
 };
 const result=await analyzeCreativeWithOpenAI(input,{maxSpendCents:100},{env,fetchImpl,now});
 assert.equal(result.originalAnalysis.source,'openai_responses');assert.equal(result.originalAnalysis.decision,'accept');
 assert.equal(result.analysis.decision,'human_review');assert.ok(result.analysis.rightsFlags.length);
 result.analysis.summary='Edited after return';assert.equal(result.originalAnalysis.summary,'Coffee static sprint');
 assert.equal(result.provenance.responseId,'resp_mock');assert.equal(result.usage?.inputTokens,1000);
 assert.ok(result.estimatedMaxCostCents<=100);
});

test('incomplete, refused, malformed, additional fields and invalid analysis responses never become analyses',async()=>{
 const bad=[{...complete(),status:'incomplete'},complete('{bad'),complete(JSON.stringify({summary:'Missing everything'})),complete(JSON.stringify({...proposal,priceCents:1})),complete(JSON.stringify({...proposal,confidence:101})),{...complete(),output:[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'No'}]}]},{...complete(),output:[{type:'function_call',name:'approve_payment'}]},{...complete(),error:{message:'failed'}},{...complete(),output:[]}];
 for(const value of bad)await assert.rejects(analyzeCreativeWithOpenAI(input,{maxSpendCents:100},{env,fetchImpl:fake(value),now}));
});

test('provider HTTP errors and network failures never echo secrets or provider text and never retry',async()=>{
 let calls=0;
 const fetchImpl:typeof fetch=async()=>{calls++;return new Response('test-never-real private@example.com',{status:429});};
 await assert.rejects(analyzeCreativeWithOpenAI(input,{maxSpendCents:100},{env,fetchImpl,now}),(error:Error)=>{assert.match(error.message,/HTTP 429/);assert.doesNotMatch(error.message,/test-never-real|private@example.com/);return true;});
 assert.equal(calls,1);
 await assert.rejects(analyzeCreativeWithOpenAI(input,{maxSpendCents:100},{env,fetchImpl:async()=>{throw new Error('test-never-real');},now}),/Spend may have occurred/);
});

test('missing permissions/assets are restored even if model overlooks them and model rejection remains rejected',async()=>{
 const result=await analyzeCreativeWithOpenAI({...input,references:[],rightsConfirmed:false},{maxSpendCents:100},{env,fetchImpl:fake(complete(JSON.stringify({...proposal,decision:'reject'}))),now});
 assert.equal(result.analysis.decision,'reject');assert.ok(result.analysis.missingAssets.length);assert.match(result.analysis.rightsFlags[0],/not confirmed/);
 assert.equal(result.originalAnalysis.rightsFlags.length,0);
});
