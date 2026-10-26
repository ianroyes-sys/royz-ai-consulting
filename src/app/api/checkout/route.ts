import {randomUUID} from 'node:crypto';
import {body,failure,json,originOK,rateLimit} from '@/lib/security';
import {getAssessment,mutateAssessment} from '@/lib/db';
import {createCheckoutSession,refreshBilling,scopeHash,stripe} from '@/lib/billing';
export async function POST(req:Request){try{
 if(!originOK(req))return json({error:'Open checkout from your private client link.'},403);
 if(!await rateLimit(req,'checkout',15,3600))return json({error:'Please try again later.'},429);
 const data=await body(req);
 if(data.consent!==true||typeof data.token!=='string'||! /^[a-f0-9]{64}$/.test(data.token))return json({error:'Please accept the scope and $1,000 monthly subscription terms.'},400);
 let a=await getAssessment(data.token,'token');if(!a)return json({error:'Client link not found.'},404);
 a=await refreshBilling(a);
 if(a.billing?.status==='abandoning')return json({error:'Checkout is being canceled. Please retry shortly.'},409);
 if(a.billing?.subscriptionId&&a.billing.status!=='canceled')return json({error:'Your subscription already exists. Use Manage billing.'},409);
 if(a.status!=='proposed'||!a.scope.trim())return json({error:'Your assessment and written scope must be reviewed before payment.'},409);
 if(data.scopeHash!==scopeHash(a.scope))return json({error:'Your scope has changed. Reload this workspace and review it before accepting.'},409);
 if(!process.env.STRIPE_SECRET_KEY)return json({error:'Checkout is not yet available. Your assessment is saved.'},503);
 let expiredCheckout:string|undefined;
 if(a.billing?.checkoutId&&a.billing.status!=='canceled'){
  const old=await stripe().checkout.sessions.retrieve(a.billing.checkoutId);
  if(old.status==='open'&&old.url)return json({url:old.url});
  if(old.status!=='expired')return json({error:'Your previous checkout is being processed. Please refresh your workspace.'},409);
  expiredCheckout=old.id;
 }
 // Reserve the exact accepted scope before making a provider call. Concurrent
 // requests share this persisted attempt, even after a timeout or failed save.
 const attempt=randomUUID();
 try{a=await mutateAssessment(a.id,current=>{
  if(current.billing?.status==='abandoning')throw new Error('Checkout is being canceled. Please retry shortly.');
  if(current.status!=='proposed'||scopeHash(current.scope)!==data.scopeHash)throw new Error('Your scope changed. Reload and review it before accepting.');
  if(current.billing?.subscriptionId&&current.billing.status!=='canceled')throw new Error('A subscription already exists. Use Manage billing.');
  if(current.billing?.checkoutAttempt&&current.billing.status==='pending'&&(!expiredCheckout||current.billing.checkoutId!==expiredCheckout))return;
  current.billing={status:'pending',checkoutAttempt:attempt,acceptedScope:current.scope,scopeHash:data.scopeHash,consentAt:new Date().toISOString(),termsVersion:'2026-09-17'};
 });}catch(e){return json({error:e instanceof Error?e.message:'Please reload and retry.'},409);}
 const metadata={assessmentId:a.id,product:'royz-ai-consulting',scopeHash:a.billing!.scopeHash!,checkoutAttempt:a.billing!.checkoutAttempt!,termsVersion:'2026-09-17'};
 const session=await createCheckoutSession(a);
 await mutateAssessment(a.id,current=>{if(current.billing?.checkoutAttempt===metadata.checkoutAttempt)current.billing.checkoutId=session.id;});
 if(!session.url)return json({error:'Checkout is already processed. Refresh your workspace.'},409);
 return json({url:session.url});
 }catch(e){return failure(e);}}
