import {body,failure,json,originOK,rateLimit} from '@/lib/security';
import {intakeSchema,newJob} from '@/lib/creative-core';
import {saveCreative} from '@/lib/creative-db';
export async function POST(req:Request){try{if(!originOK(req))return json({error:'Submit from the creative brief form.'},403);if(!await rateLimit(req,'creative-intake',8))return json({error:'Please try again later.'},429);const v=intakeSchema.safeParse(await body(req));if(!v.success)return json({error:'Check your contact details, brief, asset URLs, and rights confirmation.'},400);const j=await saveCreative(newJob(v.data));return json({token:j.token,url:'/creative/client/'+j.token},201);}catch(e){return failure(e);}}
