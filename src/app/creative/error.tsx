'use client';
import s from '@/components/creative/creative.module.css';
export default function Error({reset}:{reset:()=>void}){return <div className={s.wrap}><div className={s.page}><h2>This page could not load.</h2><p className={s.lead}>Try again. Your saved project remains in the studio.</p><button className={s.button} onClick={reset} style={{marginTop:20}}>Try again</button></div></div>}
