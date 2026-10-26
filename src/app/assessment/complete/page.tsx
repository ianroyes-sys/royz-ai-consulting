import ClientWorkspace from '@/components/client-workspace';
export const metadata={title:'Your assessment',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <ClientWorkspace token={token||''} complete/>}
