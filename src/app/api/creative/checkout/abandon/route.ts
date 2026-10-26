import {body,failure,json,originOK,rateLimit} from '@/lib/security';
import {getCreative} from '@/lib/creative-db';
import {clientProjection} from '@/lib/creative-core';
import {abandonCreativeCheckout} from '@/lib/creative-billing';
export async function POST(req:Request){try{if(!originOK(req))return json({error:'Use your private client workspace.'},403);if(!await rateLimit(req,'creative-abandon',12))return json({error:'Please try again later.'},429);const {token}=await body(req);if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return json({error:'Client link not found.'},404);const j=await getCreative(token,'token');if(!j)return json({error:'Client link not found.'},404);try{return json({job:clientProjection(await abandonCreativeCheckout(j))});}catch(e){if(e instanceof Error&&['Only an unpaid','Billing changed','Checkout is processing'].some(s=>e.message.startsWith(s)))return json({error:e.message},409);throw e;}}catch(e){return failure(e);}}
