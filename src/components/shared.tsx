import Link from 'next/link';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
export function Brand(){return <Link href="/" className="brand" aria-label="Royz Media Group home"><span className="brand-symbol">r.</span><span>ROYZ<span className="brand-sub">MEDIA GROUP</span></span></Link>}
export function Header(){return <header className="site-header"><Brand/><nav><Link href="/demo" className="nav-text">Try a workflow</Link><Link href="/#approach" className="nav-text">How it works</Link><Link className="button small" href="/assessment">Find your first automation <ArrowUpRight size={16}/></Link></nav></header>}
export function Footer(){return <footer className="footer"><Brand/><span>Less busywork. More business.</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/login">Studio login</Link></div></footer>}
export function Arrow(){return <ArrowRight size={18}/>}
export function ErrorMessage({message}:{message:string}){return message?<p role="alert" className="notice error">{message}</p>:null}
export function Loading(){return <div className="empty"><span className="loading-dot"/><p>Loading your workspace…</p></div>}
export async function request<T>(url:string,options?:RequestInit):Promise<T>{const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options?.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error||'Something went wrong. Please try again.');return data}
