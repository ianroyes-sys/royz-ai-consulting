import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:{default:'Royz — Get your workweek back',template:'%s · Royz'},description:'Practical AI consulting for local businesses. Find your first useful automation with a free assessment, then build with a clear monthly scope.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
