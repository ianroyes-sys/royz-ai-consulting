import fs from 'node:fs';
import Stripe from 'stripe';
process.loadEnvFile('.env.local');
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
const url=process.env.APP_URL;
const account=await stripe.accounts.retrieve();
if(process.env.STRIPE_EXPECTED_ACCOUNT&&account.id!==process.env.STRIPE_EXPECTED_ACCOUNT)throw new Error('Unexpected Stripe account');if(!account.charges_enabled)throw new Error('Stripe account cannot accept charges');
const changes={};
if(!process.env.STRIPE_PORTAL_CONFIGURATION){const config=await stripe.billingPortal.configurations.create({business_profile:{headline:'Royz Media Group — AI consulting',privacy_policy_url:`${url}/privacy`,terms_of_service_url:`${url}/terms`},features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none'}},metadata:{product:'royz-ai-consulting'},default_return_url:url},{idempotencyKey:'royz-ai-consulting-portal-v1'});changes.STRIPE_PORTAL_CONFIGURATION=config.id;console.log('Created service-specific customer billing portal',config.id);}
if(!process.env.STRIPE_WEBHOOK_SECRET){const hook=await stripe.webhookEndpoints.create({url:`${url}/api/stripe/webhook`,enabled_events:['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'],description:'Royz AI Consulting subscription lifecycle',metadata:{product:'royz-ai-consulting'}},{idempotencyKey:'royz-ai-consulting-webhook-v1'});changes.STRIPE_WEBHOOK_SECRET=hook.secret;changes.STRIPE_WEBHOOK_ID=hook.id;console.log('Created isolated service webhook',hook.id);}
let text=fs.readFileSync('.env.local','utf8');for(const [k,v]of Object.entries(changes))text+=`${k}=${v}\n`;fs.writeFileSync('.env.local',text,{mode:0o600});
console.log('Verified live account; saved configuration securely. No customer charge created.');
