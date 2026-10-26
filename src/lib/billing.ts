import Stripe from 'stripe';
import {createHash} from 'node:crypto';
export function scopeHash(scope:string){return createHash('sha256').update(scope).digest('hex');}
import {getAssessment,mutateAssessment} from './db';
import type {Assessment} from './types';
let instance:Stripe|undefined;
export function stripe(){const key=process.env.STRIPE_SECRET_KEY;if(!key)throw new Error('Billing is not configured');return instance??=new Stripe(key);}
export function appURL(){const url=process.env.APP_URL;if(!url)throw new Error('APP_URL is not configured');return url.replace(/\/$/,'');}
export async function syncSubscription(a:Assessment,subscriptionId:string){
 const sub=await stripe().subscriptions.retrieve(subscriptionId);
 if(sub.metadata.assessmentId!==a.id||sub.metadata.product!=='royz-ai-consulting')throw new Error('Subscription mismatch');
 return mutateAssessment(a.id,current=>{
  // Late events for an older subscription cannot replace a newer subscription.
  if(current.billing?.checkoutAttempt&&sub.metadata.checkoutAttempt!==current.billing.checkoutAttempt)return;
  if(current.billing?.subscriptionId&&current.billing.subscriptionId!==sub.id)return;
  current.billing={...current.billing,subscriptionId:sub.id,customerId:typeof sub.customer==='string'?sub.customer:sub.customer.id,status:sub.status,cancelAtPeriodEnd:sub.cancel_at_period_end};
  if(sub.status==='active')current.status='active';
  else if(current.status==='active')current.status=sub.status==='canceled'?'completed':'proposed';
 });
}
export async function refreshBilling(a:Assessment){if(!process.env.STRIPE_SECRET_KEY)return a;if(a.billing?.subscriptionId)return syncSubscription(a,a.billing.subscriptionId);if(a.billing?.checkoutId){const session=await stripe().checkout.sessions.retrieve(a.billing.checkoutId);if(session.metadata?.assessmentId===a.id&&session.status==='complete'&&session.payment_status==='paid'&&session.subscription){return syncSubscription(a,typeof session.subscription==='string'?session.subscription:session.subscription.id);}}return a;}
export async function syncFromEvent(event:Stripe.Event){let id:string|undefined;let subscriptionId:string|undefined;if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){const s=event.data.object as Stripe.Checkout.Session;if(s.metadata?.product!=='royz-ai-consulting')return;id=s.metadata.assessmentId;subscriptionId=typeof s.subscription==='string'?s.subscription:s.subscription?.id;}else if(event.type.startsWith('customer.subscription.')){const s=event.data.object as Stripe.Subscription;if(s.metadata.product!=='royz-ai-consulting')return;id=s.metadata.assessmentId;subscriptionId=s.id;}if(id&&subscriptionId){const a=await getAssessment(id);if(a)await syncSubscription(a,subscriptionId);}}

export async function createCheckoutSession(a:Assessment){
 const metadata={assessmentId:a.id,product:'royz-ai-consulting',scopeHash:a.billing!.scopeHash!,checkoutAttempt:a.billing!.checkoutAttempt!,termsVersion:'2026-09-17'};
 // Consulting uses direct merchant billing; do not inherit the account’s digital-product Managed Payments default.
 const params: Stripe.Checkout.SessionCreateParams & {managed_payments:{enabled:boolean}} = {managed_payments:{enabled:false},mode:'subscription',payment_method_types:['card'],customer_email:a.email,client_reference_id:a.id,line_items:[{price_data:{currency:'usd',unit_amount:100000,recurring:{interval:'month'},product_data:{name:'Royz AI Consulting — monthly implementation',description:'Weekly working session, one agreed priority workflow at a time, documentation and handoff. Third-party software fees are separate.'}},quantity:1}],metadata,subscription_data:{metadata},success_url:`${appURL()}/client/${a.token}?checkout=success`,cancel_url:`${appURL()}/client/${a.token}?checkout=canceled`,custom_text:{submit:{message:'$1,000 USD charged today and each month until canceled. Cancel before the next renewal. Scope agreed in your private workspace; software costs require separate approval.'}}};
 return await stripe().checkout.sessions.create(params,{idempotencyKey:`rmg-ai-${a.id}-${a.billing!.checkoutAttempt}`});
}

export async function abandonCheckout(id:string){
 let a=await getAssessment(id);if(!a)throw new Error('Assessment not found.');
 a=await refreshBilling(a);
 if(!a.billing?.checkoutAttempt||!['pending','abandoning'].includes(a.billing.status)||a.billing.subscriptionId)throw new Error('Only an unpaid checkout can be canceled here. Manage an existing subscription through billing.');
 const attempt=a.billing.checkoutAttempt;
 a=await mutateAssessment(id,current=>{
  if(current.billing?.checkoutAttempt!==attempt||!['pending','abandoning'].includes(current.billing.status)||current.billing.subscriptionId)throw new Error('Billing changed. Refresh and try again.');
  current.billing.status='abandoning';
 });
 // If checkout creation timed out, recovering the same idempotent request ensures
 // we cannot unlock a scope while an unknown session can still charge for it.
 const session=a.billing!.checkoutId?await stripe().checkout.sessions.retrieve(a.billing!.checkoutId):await createCheckoutSession(a);
 if(session.status==='complete'){
  if(session.subscription)await syncSubscription(a,typeof session.subscription==='string'?session.subscription:session.subscription.id);
  throw new Error('Checkout has completed. Manage the subscription through billing.');
 }
 if(session.status==='open')await stripe().checkout.sessions.expire(session.id);
 else if(session.status!=='expired')throw new Error('Checkout status cannot be confirmed. Please retry.');
 return mutateAssessment(id,current=>{
  if(current.billing?.checkoutAttempt!==attempt||current.billing.status!=='abandoning'||current.billing.subscriptionId)throw new Error('Billing changed. Refresh and try again.');
  const b=current.billing;
  current.consentHistory=[...(current.consentHistory||[]),{scope:b.acceptedScope!,scopeHash:b.scopeHash!,consentAt:b.consentAt!,termsVersion:b.termsVersion!,checkoutId:session.id,abandonedAt:new Date().toISOString()}];
  delete current.billing;
 });
}
