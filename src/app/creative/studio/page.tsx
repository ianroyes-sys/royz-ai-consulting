import {redirect} from 'next/navigation';
import {isAdmin} from '@/lib/security';
import Studio from '@/components/creative/studio';
export const metadata={title:'Creative studio',robots:{index:false,follow:false}};
export default async function Page(){if(!await isAdmin())redirect('/login?next=/creative/studio');return <Studio/>}
