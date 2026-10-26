import {z} from 'zod';
import {abandonCheckout} from '@/lib/billing';
import {body,failure,isAdmin,json,originOK} from '@/lib/security';
export async function POST(req:Request){try{
 if(!originOK(req)||!await isAdmin())return json({error:'Please sign in.'},401);
 const parsed=z.object({id:z.uuid()}).safeParse(await body(req));
 if(!parsed.success)return json({error:'Select a valid assessment.'},400);
 try{return json({assessment:await abandonCheckout(parsed.data.id)});}
 catch(e){return json({error:e instanceof Error?e.message:'Checkout could not be canceled. Please retry.'},409);}
 }catch(e){return failure(e);}}
