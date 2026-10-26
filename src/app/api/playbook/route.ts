import {getAssessment} from '@/lib/db';
import {deliveryBundle} from '@/lib/planner';
import {failure,isAdmin,json} from '@/lib/security';
export async function GET(req:Request){try{if(!await isAdmin())return json({error:'Please sign in.'},401);const a=await getAssessment(new URL(req.url).searchParams.get('id')||'');if(!a)return json({error:'Assessment not found.'},404);return new Response(deliveryBundle(a),{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="delivery-playbook.md"','Cache-Control':'no-store'}});}catch(e){return failure(e);}}
