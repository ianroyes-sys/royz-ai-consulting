import {isAdmin,json,originOK} from '@/lib/security';
import {providerReadiness} from '@/lib/creative-provider';
export async function GET(){if(!await isAdmin())return json({error:'Please sign in.'},401);return json(providerReadiness);}
export async function POST(req:Request){if(!originOK(req)||!await isAdmin())return json({error:'Please sign in.'},401);return json({error:providerReadiness.reason,enabled:false},409);}
