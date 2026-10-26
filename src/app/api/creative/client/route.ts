import {failure,json,rateLimit} from '@/lib/security';
import {getCreative} from '@/lib/creative-db';
import {clientProjection} from '@/lib/creative-core';
export async function GET(req:Request){try{if(!await rateLimit(req,'creative-client',120))return json({error:'Please try again later.'},429);const token=new URL(req.url).searchParams.get('token')||'';if(!/^[a-f0-9]{64}$/.test(token))return json({error:'Client link not found.'},404);const j=await getCreative(token,'token');if(!j)return json({error:'Client link not found.'},404);return json({job:clientProjection(j)});}catch(e){return failure(e);}}
