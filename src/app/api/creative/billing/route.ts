import {body,failure,json,originOK,rateLimit} from '@/lib/security';
import {getCreative} from '@/lib/creative-db';
import {clientProjection} from '@/lib/creative-core';
import {refreshCreativeBilling} from '@/lib/creative-billing';
export async function POST(req:Request){try{if(!originOK(req))return json({error:'Use your private client workspace.'},403);if(!await rateLimit(req,'creative-billing',30))return json({error:'Please try again later.'},429);const {token}=await body(req);if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return json({error:'Client link not found.'},404);const j=await getCreative(token,'token');if(!j)return json({error:'Client link not found.'},404);return json({job:clientProjection(await refreshCreativeBilling(j))});}catch(e){return failure(e);}}
