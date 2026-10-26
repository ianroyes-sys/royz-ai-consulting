# Optional structured brief analysis

Implemented server-side in `src/lib/creative-openai.ts`. No live paid request was made. Manual analysis stays available without keys or paid services.

The adapter uses the [Responses API structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs), with JSON Schema derived from the existing Zod analysis schema and validated again after completion. Incomplete responses, refusals, malformed JSON, extra fields and unexpected output types fail closed. No external tools or asset fetching occur.

## Explicit configuration and approval

All three server environment variables are required:

```dotenv
CREATIVE_OPENAI_ENABLED=false
OPENAI_API_KEY=
OPENAI_CREATIVE_MODEL=
```

The enabled flag must be exactly `true`; key and model must be set explicitly. There is no default model. The initial verified pricing entry is `gpt-6-astra`, documented by [OpenAI](https://developers.openai.com/api/docs/models/gpt-6-astra) as supporting the requested model. Documentation does not establish access for this account. Other models are blocked until their capability/pricing entry is reviewed.

```ts
const result = await analyzeCreativeWithOpenAI(validatedIntake, {
  maxSpendCents: approvedReservationCents,
  maxOutputTokens: 3000,
});
```

This is an integration example, not authorization to enable paid calls. Never derive budget approval from model output, public intake, or a client-provided number. Owner authentication and an atomic job-level reservation must precede any future route integration. Do not import the adapter into client components.

## Budget behavior and limits

The September 24, 2026 official model page lists $10/million input tokens, $12.50/million cache-write tokens, and $50/million output tokens. The reservation conservatively uses the higher cache-write input price, UTF-8 request byte length plus 4,096 framing/schema tokens, and the entire output-token cap. Unknown or more than fourteen-day-old pricing blocks calls. No tools, automatic retries, premium service tier, or remote images are requested.

The reservation is an application estimate, not a provider-enforced dollar cap. Output tokens are capped by the API request. A timeout or failed parse may still incur a charge. The adapter warns against blind retries; the caller must record/reconcile attempts and reserve against total job budget before enabling use. Returned usage cost is an estimate using conservative rates, not a provider invoice. No cumulative spend ledger is implemented by this isolated adapter.

## Review and persistence seam

Returns `originalAnalysis`, a separate editable `analysis` copy, provider/model/response-ID provenance, token usage if supplied, and estimated costs. Both analyses validate against the existing schema using `source: openai_responses`. The original preserves model advice; the editable result deterministically forces `human_review` unless the model rejects. It restores rights/asset warnings and never approves scope, production, payment, a workflow, prices or endpoints.

Persist original/provenance independently before human edits; do not overwrite the original with the edited copy. This module writes nothing to the database and sends no messages. Contact name/email, billing, owner notes and private client tokens are omitted from the prompt. The submitted brief may itself contain client information, so disclose the provider and secure required permission before activation. `store:false` is requested; it is not a promise of zero provider retention.

Tests use mocked fetch only:

```sh
node --import tsx --test tests/creative-openai.test.ts
```

No routes were added or changed by this adapter task. Until the owner integration is enabled, the UI must continue to describe its current analysis mode as rules/manual.
