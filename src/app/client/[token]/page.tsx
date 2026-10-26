import ClientWorkspace from '@/components/client-workspace';
export const metadata={title:'Your workspace',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <ClientWorkspace token={token}/>}
