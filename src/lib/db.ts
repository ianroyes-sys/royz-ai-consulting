import {createClient, type Client} from '@libsql/client';
import {mkdirSync} from 'node:fs';
import type {Assessment,Prospect} from './types';
let client:Client|undefined; let ready:Promise<void>|undefined;
export function db(){
 if(!client){ const url=process.env.TURSO_DATABASE_URL; if(!url && process.env.VERCEL)throw new Error('Persistent database is not configured'); if(!url)mkdirSync('data',{recursive:true}); client=createClient({url:url||'file:data/consulting.db',authToken:process.env.TURSO_AUTH_TOKEN}); } return client;
}
export async function init(){ if(!ready)ready=(async()=>{await db().batch([
'CREATE TABLE IF NOT EXISTS rmg_ai_assessments (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS rmg_ai_prospects (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL)',
'CREATE TABLE IF NOT EXISTS rmg_ai_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)',
'CREATE TABLE IF NOT EXISTS rmg_ai_events (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)'
],'write');})().catch(e=>{ready=undefined;throw e;}); return ready; }
export async function saveAssessment(a:Assessment){await init();await db().execute({sql:'INSERT INTO rmg_ai_assessments(id,token,email,created_at,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',args:[a.id,a.token,a.email,a.createdAt,JSON.stringify(a)]});}
export async function getAssessment(value:string,by:'id'|'token'='id'):Promise<Assessment|null>{await init(); const r=await db().execute({sql:`SELECT data FROM rmg_ai_assessments WHERE ${by}=?`,args:[value]});return r.rows[0]?JSON.parse(String(r.rows[0].data)):null;}
export async function assessments():Promise<Assessment[]>{await init();return (await db().execute('SELECT data FROM rmg_ai_assessments ORDER BY created_at DESC LIMIT 1000')).rows.map(r=>JSON.parse(String(r.data)));}
export async function prospects():Promise<Prospect[]>{await init();return (await db().execute('SELECT data FROM rmg_ai_prospects ORDER BY created_at DESC LIMIT 1000')).rows.map(r=>JSON.parse(String(r.data)));}
export async function saveProspect(p:Prospect){await init();await db().execute({sql:'INSERT INTO rmg_ai_prospects(id,created_at,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',args:[p.id,p.createdAt,JSON.stringify(p)]});}
export async function limit(key:string,max:number,seconds:number){await init();const now=Math.floor(Date.now()/1000);const bucket=Math.floor(now/seconds);const r=await db().execute({sql:'INSERT INTO rmg_ai_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',args:[`${key}:${bucket}`,now+seconds]}); await db().execute({sql:'DELETE FROM rmg_ai_limits WHERE expires < ?',args:[now-seconds]});return Number(r.rows[0].count)<=max;}

// Compare-and-swap keeps unrelated edits from overwriting concurrent billing updates.
// The callback may run more than once and must not perform external side effects.
export async function mutateAssessment(id:string,change:(current:Assessment)=>void):Promise<Assessment>{
 await init();
 for(let attempt=0;attempt<12;attempt++){
  const result=await db().execute({sql:'SELECT data FROM rmg_ai_assessments WHERE id=?',args:[id]});
  if(!result.rows[0])throw new Error('Assessment not found');
  const before=String(result.rows[0].data);const current:Assessment=JSON.parse(before);change(current);
  const updated=await db().execute({sql:'UPDATE rmg_ai_assessments SET data=? WHERE id=? AND data=?',args:[JSON.stringify(current),id,before]});
  if(updated.rowsAffected===1)return current;
 }
 throw new Error('Assessment changed too frequently; retry required');
}
