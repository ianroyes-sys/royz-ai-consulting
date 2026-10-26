# Creative studio backend

The launch service is a $350 USD one-time specialty-coffee static pilot: one SKU, three concepts in square/portrait, six PNGs, one revision, three business days after approved assets and payment. This is a human-assisted service. It does not claim autonomous creative production, revenue, customers, or AI analysis that has not run.

## API contract

All endpoints use no-store JSON. Owner operations use the existing signed admin cookie, and mutations enforce the existing same-origin check. Public intake and token endpoints are rate limited. A 64-character random token is a bearer secret; do not post client links publicly.

- `POST /api/creative/intake`: `{name,email,brand,brief,deadline?,references?:httpsURLs[],rightsConfirmed}`. Persists before returning `{token,url}`.
- `GET /api/creative/studio`: authenticated `{jobs,catalog,templates,settings}`. Jobs include economics and QA checks.
- `POST /api/creative/studio`: intake fields plus optional `demo:true`; returns `{job}`. Demo never accepts checkout or counts as paid revenue.
- `PATCH /api/creative/studio`: `{id,action,...}`. Actions: update, approve, reject, qa, deliver, drafts, revision, approve_revision, complete_revision. Update can edit analysis, workflow, outputs, memory, notes, references, rightsConfirmed, deadline, scope, contingencyCents, channelFeeBps. Production budget is fixed to zero. Reference/rights/plan/scope changes revoke approval, and are locked after consent.
- `GET /api/creative/client?token=…`: safe projection. Hides contact email, token, owner notes, audit, memory, economics, and unreleased outputs.
- `POST /api/creative/checkout`: `{token,consent:true,scopeHash}` returns Stripe hosted checkout URL. Owner must first approve the scope. Never trusts a browser success redirect as payment proof.
- `POST /api/creative/billing`: `{token}` retrieves Stripe session and verifies live paid USD 350.00, matching product, job, attempt, session and scope.
- `POST /api/creative/checkout/abandon`: `{token}`. Recovers a timed-out creation idempotently if necessary, expires the unpaid session, then verifies exact expiry before unlocking scope. Completed or ambiguous payment remains locked.
- `GET /api/creative/production`: owner-only truthful readiness. `POST` remains disabled under the zero-dollar generation budget.

`syncCreativeFromEvent(event)` is exported for the existing signed Stripe webhook. Parent integration must call it only after Stripe signature verification. Real revenue requires `livemode:true`; Stripe test mode is never represented as real payment.

## Data and invariants

`rmg_creative_jobs` stores jobs and original/human-edited analysis, output records, revision records, billing consent, and embedded audit view. `rmg_creative_audit` is separate append-only through application operations. Job mutation and audit append occur in one write transaction. `rmg_creative_memory` is keyed by SHA-256 of normalized email plus brand. Owner edits save account preferences and future jobs can reuse those preferences; no rights or likeness approvals carry forward. Public projections never expose account memory.

Costs use integer cents and channel-fee basis points. Models with missing prices, forged prices, disabled catalog entries, or unknown IDs fail the budget gate. There are no paid generation records; actual API spend is zero. Gross margin is generation-only and explicitly excludes labor, taxes, and unconfigured processing fees.

Delivery requires QA stage, scope approval, resolved missing inputs/rights, verified payment (or explicit demo), six distinct PNG URL/ID records covering three 1080×1080/1080×1350 pairs, and human brand/text/rights/visual attestations. Checks validate declared metadata, not pixels. A human must inspect actual files. Included revisions revoke prior visual approval; second rounds require a separate change order and cannot silently charge.

Outputs support private owner-uploaded PNGs stored in `rmg_creative_assets` BLOB rows. `POST /api/creative/assets?jobId=UUID&concept=1|2|3` takes a raw `image/png` body; `GET /api/creative/assets/UUID?token=TOKEN` serves only authenticated owners or the correct client after delivery. Files use no-store/nosniff headers. PNG structure, checksums, decompressed pixel stream and 1080×1080/1080×1350 dimensions are inspected. The cap is 3.5MB/file, 30 retained files/job, and 100MB total. SHA-256 rejects duplicate image bytes within a job. Upload, descriptor replacement and audit append are atomic. Replacements reset approvals; old versions remain owner-only. Delivered/rejected jobs cannot be changed through uploads. An approved revision returns the job to QA before replacement.

Private descriptors are immutable through the metadata-edit endpoint. The application never fetches arbitrary asset URLs. Advanced external HTTPS links remain possible but their access/retention is the owner's responsibility. Do not use public portfolio paths for confidential client files. Provider video/audio archival is not implemented.

## Provider implementation and limits

The server-only `HiggsfieldAdapter` contains schema-validated REST methods for:

- SOUL v2 image: `higgsfield-ai/soul/v2/standard`.
- Genjutsu motion transfer video: `higgsfiled/genjutsu/motion-transfer/v1.0` (the unusual spelling is documented).
- Authoritative authenticated cost estimates, conservative cent rounding, reserve/persist callbacks, bounded polling with exponential backoff, queued-only cancellation, and image/video/audio normalization.

Actual failed/nsfw/canceled cost is zero; completed actual cost remains unknown unless independently reconciled. Provider URLs are validated before credentials are sent; redirects are disabled. Application polling timeout is separate from provider status. An ambiguous submit failure is never retried automatically. Every retry must start a new application generation record; the failed record must be retained by the eventual integration.

No live API request or paid connection test was made. Production routes intentionally do not instantiate this adapter. Full activation needs a nonzero user-approved budget, account credentials/access verification, provider output ingestion into private storage (PNG upload is implemented; video/audio archival is not), and real image/video lifecycle tests. The standalone atomic generation reservation ledger is implemented below. A pure-code adapter does not imply those integrations are complete.

Official sources checked 2026-09-23:

- https://docs.higgsfield.ai/docs/models/soul-2/generate
- https://docs.higgsfield.ai/docs/models/genjutsu/motion-transfer
- https://docs.higgsfield.ai/docs/concepts/requests
- https://docs.higgsfield.ai/docs/concepts/billing-and-retention

## Reservation ledger seam

`creative-ledger.ts` creates `rmg_creative_reservations`. `reserveCreativeAttempt` atomically checks owner-approved scope/model/step, real payment, positive production budget, cumulative held cost plus contingency, and total attempt count before saving a reservation and audit event. A repeated idempotency key returns `created:false`; callers must not resubmit that attempt. A key cannot describe changed work. All failed attempts still count toward the approved attempt ceiling. `reconcileCreativeAttempt` keeps uncertain or completed-but-unpriced reservations held; verified failed/canceled results release cost, completed known cost reconciles it. Terminal records cannot be reset for retries. These functions are not exposed as paid-production routes. Existing endpoints still enforce a $0 budget; the ledger test authorizes a fake budget only in an isolated temporary database. OpenAI analysis needs a separately authorized analysis workflow/step before this seam could support it.

## Mapping to six original prompts

1. Real jobs, analyses, workflows, output/revision records, costs and audit are persisted. UI owns recording/demo screens.
2. Default analysis is labelled `manual_rules`, editable and compared to the original. No fake Astra call. Optional separately documented OpenAI adapter is not the default and cannot spend at $0.
3. Documented Higgsfield adapter implemented and mock-transport tested; live integration/asset archival are blocked as described above.
4. Transparent enabled manual lane plus disabled documented model entries; price and spend gates deterministic. Unknown model pricing cannot be guessed.
5. Six static outputs have strict metadata and human QA, included-revision accounting and delivery gate. No claim of automated visual inspection. Cinematic video examples are planning/demo material, not fulfilled client projects.
6. Questions/proposal/progress/delivery/follow-up drafts, account memory, revisions and audit are implemented. Messaging is draft-only. Final delivery always requires owner action. No automatic contract acceptance, paid repair, external marketplace actions, or client messages. Launch Video, UGC Ad Pack and Localization Pack are explicitly proposal-only templates; no checkout for unsupported fulfillment.

Run `node --import tsx --test tests/creative.test.ts` and `npx tsc --noEmit`. Adapter tests use injected mock fetch responses and never contact the provider.
