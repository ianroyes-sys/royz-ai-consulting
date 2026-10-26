import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {limit} from './db';
export const COOKIE='royz_ai_session';
function secret(){const s=process.env.AUTH_SECRET;if(!s||s.length<32)throw new Error('Authentication is not configured');return s;}
export function signSession(){const body=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000})).toString('base64url');return `${body}.${createHmac('sha256',secret()).update(body).digest('base64url')}`;}
export function verifySession(token:string){try{const [body,sig,...extra]=token.split('.');if(extra.length||!body||!sig)return false;const expected=createHmac('sha256',secret()).update(body).digest('base64url');if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;const exp=JSON.parse(Buffer.from(body,'base64url').toString()).exp;return typeof exp==='number'&&exp>Date.now()&&exp<=Date.now()+8*3600000;}catch{return false;}}
export async function isAdmin(){return verifySession((await cookies()).get(COOKIE)?.value||'');}
export function samePassword(value:string){const configured=process.env.ADMIN_PASSWORD;if(!configured||configured.length<16)return false;return timingSafeEqual(createHash('sha256').update(value).digest(),createHash('sha256').update(configured).digest());}
export function originOK(req:Request){const origin=req.headers.get('origin'); if(!origin)return false; const expected=process.env.APP_URL?new URL(process.env.APP_URL).origin:new URL(req.url).origin;return origin===expected||(!process.env.VERCEL&&origin===new URL(req.url).origin)||(process.env.NODE_ENV==='development'&&!process.env.VERCEL&&['http://127.0.0.1:3091','http://localhost:3091'].includes(origin));}
export async function rateLimit(req:Request,kind:string,max=12,seconds=3600){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';return limit(kind+':'+createHash('sha256').update(ip).digest('hex').slice(0,24),max,seconds);}
export function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>30000)throw new Error('Request too large');const text=await req.text();if(text.length>30000)throw new Error('Request too large');return JSON.parse(text);}
export function failure(e:unknown){console.error('Request failed:',e instanceof Error?e.name:'UnknownError');if(process.env.NODE_ENV==='development'&&e instanceof Error)console.error(e.stack?.split('\n').slice(1,4).join('\n'));return json({error:'We could not save this request. Please try again, or contact contact@royzmediagroup.com.'},503);}
