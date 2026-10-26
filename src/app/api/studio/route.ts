import {z} from 'zod';
import {assessments,getAssessment,prospects,mutateAssessment} from '@/lib/db';
import {body,failure,isAdmin,json,originOK} from '@/lib/security';
const update=z.object({id:z.uuid(),status:z.enum(['new','contacted','assessed','proposed','active','completed','lost']).optional(),notes:z.string().max(10000).optional(),scope:z.string().max(10000).optional(),tasks:z.array(z.object({title:z.string().max(500),done:z.boolean()})).max(30).optional()});
export async function GET(){try{if(!await isAdmin())return json({error:'Please sign in.'},401);return json({assessments:await assessments(),prospects:await prospects(),settings:{billingReady:!!process.env.STRIPE_SECRET_KEY}});}catch(e){return failure(e);}}
export async function PATCH(req:Request){try{if(!originOK(req)||!await isAdmin())return json({error:'Please sign in.'},401);const v=update.safeParse(await body(req));if(!v.success)return json({error:'Check the selected stage and notes.'},400);const a=await getAssessment(v.data.id);if(!a)return json({error:'Assessment not found.'},404);let updated;try{updated=await mutateAssessment(a.id,current=>{
 if(v.data.status==='active'&&current.billing?.status!=='active')throw new Error('Active requires a verified paid subscription.');
 if(v.data.status==='proposed'&&!(v.data.scope??current.scope).trim())throw new Error('Write the agreed scope before enabling checkout.');
 if(v.data.scope!==undefined&&v.data.scope!==current.scope&&current.billing?.acceptedScope&&current.billing.status!=='canceled')throw new Error('Scope is locked after checkout consent. Cancel the subscription before changing the agreed scope.');
 Object.assign(current,v.data);
 });}catch(e){return json({error:e instanceof Error?e.message:'Could not update assessment.'},409);}
 return json({assessment:updated});}catch(e){return failure(e);}}
