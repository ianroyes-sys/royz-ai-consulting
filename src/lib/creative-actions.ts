import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {analysisSchema,economics,safeURL,memorySchema,outputsSchema,qa,refreshDrafts,workflowSchema} from './creative-core';
import type {CreativeJob} from './creative-types';
export const patchSchema=z.object({id:z.uuid(),action:z.enum(['update','approve','reject','qa','deliver','drafts','revision','approve_revision','complete_revision']),analysis:analysisSchema.optional(),workflow:workflowSchema.optional(),outputs:outputsSchema.optional(),memory:memorySchema.optional(),notes:z.string().max(10000).optional(),references:z.array(safeURL).max(12).optional(),rightsConfirmed:z.boolean().optional(),deadline:z.string().max(100).optional(),scope:z.string().min(30).max(5000).optional(),productionBudgetCents:z.literal(0).optional(),contingencyCents:z.number().int().min(0).max(35000).optional(),channelFeeBps:z.number().int().min(0).max(10000).optional(),note:z.string().min(3).max(2000).optional(),deliverable:z.string().max(300).optional(),actionText:z.string().max(1000).optional(),costCents:z.literal(0).optional(),revisionId:z.uuid().optional()});
export function applyCreativeAction(j:CreativeJob,v:z.infer<typeof patchSchema>){
 if(j.stage==='delivered'&&!['revision','approve_revision','complete_revision','drafts'].includes(v.action))throw new Error('Delivered job is locked. Record a revision to continue.');
 if(v.action==='update'){
  if(v.outputs)for(const output of v.outputs){const previous=j.outputs.find(o=>o.id===output.id);if(output.storage==='private-db'||output.url.startsWith('/api/creative/assets/')||previous?.storage==='private-db'){if(!previous||previous.storage!=='private-db'||['url','concept','width','height','storage','sha256','bytes','demo'].some(key=>output[key as keyof typeof output]!==previous[key as keyof typeof previous]))throw new Error('Private asset metadata is immutable. Upload a new PNG to replace it.');}}
  const scopeChange=v.scope!==undefined&&v.scope!==j.scope;const planningChange=v.analysis!==undefined||v.workflow!==undefined||v.references!==undefined||v.rightsConfirmed!==undefined||v.deadline!==undefined;
  if(j.billing&&(scopeChange||planningChange||v.channelFeeBps!==undefined||v.contingencyCents!==undefined))throw new Error('Scope and production plan are locked after checkout consent.');
  for(const k of ['workflow','outputs','memory','notes','references','rightsConfirmed','deadline','scope','productionBudgetCents','contingencyCents','channelFeeBps'] as const)if(v[k]!==undefined)Object.assign(j,{[k]:v[k]});
  if(v.analysis)j.analysis={...v.analysis,source:'human_edited'};
  if(scopeChange||planningChange){j.scopeApproved=false;j.stage='needs_review';}
 }
 if(v.action==='approve'){
  if(j.stage==='rejected'||j.analysis.decision==='reject')throw new Error('Resolve the rejection before approval.');
  if(!j.rightsConfirmed||j.analysis.rightsFlags.length||j.analysis.missingAssets.length||!j.references.length)throw new Error('Resolve rights, missing assets, and references before approval.');
  if(!economics(j).withinBudget||!j.workflow.length)throw new Error('Approved workflow must fit the $0 generation budget with verified prices.');
  j.scopeApproved=true;j.stage='approved';j.workflow.forEach(s=>s.approved=true);
 }
 if(v.action==='reject'){if(j.billing)throw new Error('Resolve billing before rejecting a consented job.');j.stage='rejected';j.scopeApproved=false;}
 if(v.action==='qa'){if(!j.scopeApproved||(!j.demo&&j.billing?.status!=='paid'))throw new Error('Approve scope and verify payment before production QA.');j.stage='qa';}
 if(v.action==='deliver'){if(j.stage!=='qa'||!qa(j).passed)throw new Error('Delivery requires QA stage and all checks passing.');j.stage='delivered';}
 if(v.action==='revision'){if(!v.note)throw new Error('A revision note is required.');j.revisions.push({id:randomUUID(),note:v.note,deliverable:v.deliverable||'Package',action:v.actionText||'Owner review required',costCents:v.costCents||0,status:'requested',included:j.revisions.length===0,createdAt:new Date().toISOString()});}
 if(v.action==='approve_revision'||v.action==='complete_revision'){const r=j.revisions.find(r=>r.id===v.revisionId);if(!r)throw new Error('Revision not found.');if(!r.included)throw new Error('Additional rounds require a separately agreed change order; not enabled.');if(v.action==='approve_revision'){if(r.status!=='requested')throw new Error('Only requested revisions can be approved.');if(r.costCents>0||!economics(j).withinBudget)throw new Error('Revision exceeds approved budget.');r.status='approved';j.stage='qa';j.outputs.forEach(o=>o.humanApproved=false);}else{if(r.status!=='approved'||!qa(j).passed)throw new Error('Revision requires approval and renewed QA.');r.status='completed';}}
 refreshDrafts(j);
}
