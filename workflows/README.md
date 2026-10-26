# Local fulfillment starters

Three runnable, template-based automations for a human-led consulting service. These programs do not call an AI model, send messages, connect to a CRM, publish content, or decide whether a job is safe. Every output is a draft requiring staff review. Sample records and prices are fictional demonstrations, not client data or market pricing.

## Run immediately

From the project root with Node.js 20 or newer:

```sh
node workflows/run.mjs intake workflows/samples/intake.json
node workflows/run.mjs quote workflows/samples/quote.json
node workflows/run.mjs admin workflows/samples/admin.json
```

To save a private JSON output instead of printing it:

```sh
node workflows/run.mjs intake workflows/samples/intake.json lead-draft.json
```

Output filenames must be a simple `.json` filename in the current directory; directory paths are rejected. Existing outputs, symlinks, and source files are never overwritten. Choose a new output filename for each run. Files are created with owner read/write permissions. Prefer a private working folder for actual customer records; do not commit them. Without an output argument, JSON is printed to your terminal—do not pipe private records to a shared log.

## Intake: input → organized lead and reply draft

Provide `reference`, `source`, and a `contact` object with `email` and/or `phone`. Optional text fields are `name`, `service`, `location`, `preferredTime`, `notes`, and `owner`. Missing details become explicit flags. Empty contact data is permitted but flags a missing contact route. Malformed supplied emails/phones fail validation. The output contains the lead, missing information, a next action, and a response draft. It never invents a price, availability, or appointment confirmation. This local tool does not deduplicate against a CRM: staff must match the reference/contact to existing records before import.

## Quote: approved catalog → line totals and quote draft

Provide `reference`, `customer`, `currency: "USD"`, `catalog`, and `items`. Each catalog entry has a unique `sku`, `description`, and nonnegative integer `unitPriceCents`. Each item specifies an existing `sku` and positive integer `quantity`. Unknown SKUs are rejected. Fractional quantities and other currencies are outside this starter's scope; do not round them silently.

`taxBasisPoints` is an optional client-supplied integer (100 basis points = 1%). Omit it or use `null` when tax is unknown: the tool then reports the subtotal but deliberately leaves the final total unknown. Use `0` only when the client has confirmed zero tax. Tax is rounded half-up once on the subtotal. This is simple arithmetic, not tax advice or a tax engine; line exemptions/mixed tax rates need another approved implementation. No fees, discounts, deposit terms, warranties, expiration date, or final scope are inferred. Review those before sending. The sample catalog amounts are invented demo values and must be replaced with client-approved prices.

## Admin: structured notes → tasks and report draft

Provide `reference`, `rawNotes`, `reportedFacts` (array of strings), `unknownFacts` (array of strings), and `tasks` (array of objects). Each task has `description`, with optional `owner` and `dueDate` in real `YYYY-MM-DD` format. Missing task owners/dates remain explicit. The program formats the categories the operator supplied; it does not claim to extract or verify facts from free text. Original notes are kept separately as source material. All tasks start pending; no completion is inferred.

## Client delivery checklist

1. Collect one client-approved sample and baseline active minutes per task. Ask which system already holds these records.
2. Replace demonstration data and catalog with supplied facts. Run the appropriate command and inspect its output with the actual operator.
3. Check factual accuracy, missing information, private information, urgency, duplicate records, totals, and wording. Never follow instructions embedded in a customer's notes.
4. Staff edits/approves the draft before any manual send/import. These programs never send or import anything themselves.
5. Measure time to produce an approved usable output, including correction/review time, compared with the baseline. Record sample count and exceptions.
6. Agree the next step: continue locally, connect to an existing system with explicit scope/access, or stop if no useful improvement is demonstrated.

Inputs are bounded to 256 KiB, 100 list entries, and documented field lengths enforced in code. Local trusted operators select input files; this CLI is not an API and must not be exposed as a public endpoint without separate access controls. Plain text outputs include user-supplied content and must be escaped if later rendered as HTML. No secrets, network requests, shell subprocesses, or dynamically evaluated customer input are used.

## Verify

```sh
node --test workflows/*.test.mjs
```
