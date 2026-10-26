#!/usr/bin/env node
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 256 * 1024;
function fail(message) { throw new Error(message); }
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
  return value;
}
function text(value, name, { optional = false, max = 4000 } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail(`${name} must be nonempty text of at most ${max} characters`);
  return value.trim();
}
function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${name} must be an integer between ${min} and ${max}`);
  return value;
}
function list(value, name, max = 100) {
  if (!Array.isArray(value) || value.length > max) fail(`${name} must be an array of at most ${max} items`);
  return value;
}
function contact(value) {
  object(value, 'contact');
  const email = text(value.email, 'contact.email', { optional: true, max: 254 });
  const phone = text(value.phone, 'contact.phone', { optional: true, max: 40 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) fail('contact.email is invalid');
  if (phone && (!/^[+\d().\s-]+$/u.test(phone) || phone.replace(/\D/g, '').length < 7)) fail('contact.phone is invalid');
  return { email, phone };
}
function date(value, name) {
  const result = text(value, name, { optional: true, max: 10 });
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result)) fail(`${name} must be a real YYYY-MM-DD date`);
  return result;
}
function base(workflow) {
  return { schemaVersion: 1, workflow, method: 'template-based; no AI model used', status: 'draft', approvalRequired: true, externalActionsPerformed: false };
}

export function intake(input) {
  object(input, 'input');
  const lead = {
    reference: text(input.reference, 'reference', { max: 100 }),
    name: text(input.name, 'name', { optional: true, max: 200 }),
    contact: contact(input.contact),
    service: text(input.service, 'service', { optional: true, max: 300 }),
    location: text(input.location, 'location', { optional: true, max: 300 }),
    preferredTime: text(input.preferredTime, 'preferredTime', { optional: true, max: 300 }),
    source: text(input.source, 'source', { max: 300 }),
    notes: text(input.notes, 'notes', { optional: true }),
    owner: text(input.owner, 'owner', { optional: true, max: 200 }),
  };
  const missingInformation = [];
  for (const key of ['name', 'service', 'location', 'preferredTime', 'owner']) if (!lead[key]) missingInformation.push(key);
  if (!lead.contact.email && !lead.contact.phone) missingInformation.push('contact.email or contact.phone');
  return {
    ...base('lead-intake'), lead, missingInformation,
    nextAction: 'Staff must check urgency, duplicates, service coverage and availability before replying.',
    replyDraft: `Hello${lead.name ? ` ${lead.name}` : ''},\n\nThank you for your inquiry${lead.service ? ` about ${lead.service}` : ''}. Our team will review your request. This is not an appointment confirmation or a price quote.${!lead.location ? '\nPlease share the service location.' : ''}${!lead.preferredTime ? '\nPlease share your preferred appointment time.' : ''}\n\nThank you`,
  };
}

export function quote(input) {
  object(input, 'input');
  if (input.currency !== 'USD') fail('currency must be USD; all amounts use integer cents');
  const reference = text(input.reference, 'reference', { max: 100 });
  const customer = text(input.customer, 'customer', { max: 200 });
  const catalog = new Map();
  for (const [i, value] of list(input.catalog, 'catalog').entries()) {
    object(value, `catalog[${i}]`);
    const sku = text(value.sku, `catalog[${i}].sku`, { max: 100 });
    if (catalog.has(sku)) fail(`Duplicate catalog SKU: ${sku}`);
    catalog.set(sku, { sku, description: text(value.description, `catalog[${i}].description`, { max: 500 }), unitPriceCents: integer(value.unitPriceCents, `catalog[${i}].unitPriceCents`, 0, 100_000_000) });
  }
  const items = list(input.items, 'items');
  if (!items.length) fail('items must contain at least one line');
  const lines = items.map((value, i) => {
    object(value, `items[${i}]`);
    const sku = text(value.sku, `items[${i}].sku`, { max: 100 });
    const entry = catalog.get(sku);
    if (!entry) fail(`Unknown SKU ${sku}; provide a client-approved catalog price`);
    const quantity = integer(value.quantity, `items[${i}].quantity`, 1, 10_000);
    return { ...entry, quantity, lineTotalCents: entry.unitPriceCents * quantity };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const taxBasisPoints = input.taxBasisPoints === undefined || input.taxBasisPoints === null ? null : integer(input.taxBasisPoints, 'taxBasisPoints', 0, 100_000);
  // BigInt keeps half-up rounding exact even with large permitted catalogs.
  const taxCents = taxBasisPoints === null ? null : Number((BigInt(subtotalCents) * BigInt(taxBasisPoints) + 5000n) / 10000n);
  const totalCents = taxCents === null ? null : subtotalCents + taxCents;
  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  return {
    ...base('quote-draft'), reference, customer, currency: 'USD', lines, subtotalCents, taxBasisPoints, taxCents, totalCents,
    unknownFacts: ['Final scope and client acceptance', 'Validity period', 'Any fees or discounts not supplied', ...(taxCents === null ? ['Applicable tax; no final total calculated'] : [])],
    quoteDraft: `DRAFT — STAFF APPROVAL REQUIRED\nFor: ${customer}\nReference: ${reference}\n\n${lines.map(line => `${line.description}: ${line.quantity} × ${money(line.unitPriceCents)} = ${money(line.lineTotalCents)}`).join('\n')}\n\nSubtotal: ${money(subtotalCents)}\n${taxCents === null ? 'Tax: not supplied\nFinal total: pending tax confirmation' : `Tax (client-supplied rate): ${money(taxCents)}\nTotal of supplied items and tax: ${money(totalCents)}`}\n\nPrices come only from the supplied catalog. Confirm scope, taxes, fees, discounts and terms before sending.`,
  };
}

export function admin(input) {
  object(input, 'input');
  const reference = text(input.reference, 'reference', { max: 100 });
  const rawNotes = text(input.rawNotes, 'rawNotes');
  const reportedFacts = list(input.reportedFacts, 'reportedFacts').map((value, i) => text(value, `reportedFacts[${i}]`, { max: 1000 }));
  const unknownFacts = list(input.unknownFacts, 'unknownFacts').map((value, i) => text(value, `unknownFacts[${i}]`, { max: 1000 }));
  const tasks = list(input.tasks, 'tasks').map((value, i) => {
    object(value, `tasks[${i}]`);
    const owner = text(value.owner, `tasks[${i}].owner`, { optional: true, max: 200 });
    const dueDate = date(value.dueDate, `tasks[${i}].dueDate`);
    return { description: text(value.description, `tasks[${i}].description`, { max: 1000 }), owner, dueDate, status: 'pending', missingInformation: [...(!owner ? ['owner'] : []), ...(!dueDate ? ['dueDate'] : [])] };
  });
  return {
    ...base('admin-report'), reference, rawNotes, reportedFacts, unknownFacts, tasks,
    reportDraft: `DRAFT — UNVERIFIED USER-SUPPLIED NOTES\nReference: ${reference}\n\nReported facts (not independently verified):\n${reportedFacts.map(x => `- ${x}`).join('\n') || '- None supplied'}\n\nUnknown / needs confirmation:\n${unknownFacts.map(x => `- ${x}`).join('\n') || '- None listed; staff must check for omissions'}\n\nPending tasks:\n${tasks.map(x => `- ${x.description} | Owner: ${x.owner || 'unassigned'} | Due: ${x.dueDate || 'not supplied'}`).join('\n') || '- None supplied'}\n\nOriginal notes (reference only):\n${rawNotes}`,
  };
}

export async function main(args = process.argv.slice(2)) {
  const [workflow, inputPath, outputPath, ...extra] = args;
  const runners = new Map([['intake', intake], ['quote', quote], ['admin', admin]]);
  if (!runners.has(workflow) || !inputPath || extra.length) fail('Usage: node workflows/run.mjs <intake|quote|admin> INPUT.json [OUTPUT.json]');
  if (outputPath && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.json$/.test(outputPath)) fail('Output must be a safe .json filename in the current directory (no paths)');
  const path = resolve(inputPath);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) fail('Input must be a regular JSON file, not a symlink, no larger than 256 KiB');
  const data = await readFile(path, 'utf8');
  if (Buffer.byteLength(data) > MAX_BYTES) fail('Input exceeds 256 KiB');
  const result = runners.get(workflow)(JSON.parse(data));
  const rendered = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    // Exclusive creation rejects existing files/symlinks, including the input file.
    await writeFile(resolve(outputPath), rendered, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    process.stderr.write(`Created ${outputPath}; draft requires human review.\n`);
  } else process.stdout.write(rendered);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`Workflow failed: ${error.message}\n`); process.exitCode = 1; });
}
