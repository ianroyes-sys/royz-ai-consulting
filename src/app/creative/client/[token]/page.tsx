import Portal from '@/components/creative/portal';
export const metadata={title:'Your creative project',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <Portal token={token}/>}
