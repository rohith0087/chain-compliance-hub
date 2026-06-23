# TraceR2C Phase 2: Email Reply Ingestion

## Objective

Allow a supplier to reply to a TraceR2C request email with attachments while preserving the same evidence, security, and human-verification controls as portal uploads.

Phase 2 must:

1. Receive supplier replies through Resend Inbound.
2. Associate likely attachments with an existing document request.
3. Quarantine unknown, ambiguous, unsafe, or unmatched messages.
4. Create evidence candidates only.
5. Require a human decision before an attachment changes request or compliance state.

Email is an ingestion channel, not a trusted evidence source and not an authorization mechanism.

## Implementation status — 2026-06-22

The guarded Phase 2 foundation is implemented and deployed to the `Complience`
Supabase project. `email_reply_ingestion_v1` remains off by default, so no buyer
or supplier is enrolled until the receiving domain, scanner, and canary are
explicitly configured.

Implemented:

- per-delivery `reply+r2c-<26-character-base32-token>@inbound.tracer2c.com`
  aliases generated from 128 bits with only SHA-256 hashes stored;
- stable request references, token supersession/grace, absolute expiry, recipient
  suppression, and unified request/reminder/correction delivery;
- signed and replay-safe `email.received` webhook intake;
- durable leased processing jobs with retry and dead-letter states;
- private raw-message provenance and attachment quarantine buckets;
- deterministic buyer, supplier, sender-membership, token, and request checks;
- attachment size, signature, encryption, hash, duplicate, and malware gates;
- buyer review queue with safe text rendering and short-lived previews;
- service-only, row-locked accept/reassign/correction/not-relevant/malicious
  intake decisions and an atomic buyer approval/rejection transaction;
- append-only structured review decisions, immutable resubmission versions,
  correction delivery, buyer-scoped attestations and compliance reevaluation;
- canonical evidence finalization only after an authenticated human accepts;
- RLS, private service tables, append-only review decisions, cron processing,
  database assertions, and Edge security/build gates.

Current safe v1 constraints:

- deterministic routing-token matches are accepted for review; threading-header
  and AI fallbacks remain shadow/future signals and cannot create a match;
- PDF, PNG, JPEG, DOCX and XLSX are supported; OOXML is bounded and checked for
  expansion, traversal, macros, embedded objects and external relationships;
  archives, legacy Office, encrypted and macro-enabled files are quarantined;
- optional AI request matching is shadow-only behind
  `email_reply_ai_shadow_v1` and cannot mutate evidence state;
- HTML is retained only in raw provenance and is not rendered; the review UI
  displays bounded plain text;
- unknown messages are platform-quarantine data; no automatic response is sent;
- production activation still requires the Resend receiving domain/webhook event,
  inbound routing secret/domain, malware scanner credentials, and one-buyer canary.

## Non-negotiable rules

- Never trust `From`, subject text, filename, extension, or attachment MIME independently.
- Never mark a request submitted from the inbound webhook.
- Never create canonical evidence directly from an email attachment.
- Never expose quarantine files to normal buyer or supplier document views.
- Never acknowledge unknown senders with request or organization information.
- Store the original email and its provider identifiers as immutable provenance.
- All webhook, retrieval, scanning, matching, and review operations are idempotent.
- Human review is required even for a high-confidence match.

## Resend design

### Receiving domain

Use a dedicated subdomain such as:

`inbound.tracer2c.com`

Do not move the root domain's existing MX records. Resend recommends a receiving subdomain when existing mail services must remain intact.

### Request-specific reply address

Each outbound request delivery receives a reply alias:

`reply+r2c-<26-character-base32-token>@inbound.tracer2c.com`

The token is:

- cryptographically random;
- stored only as a SHA-256 hash in TraceR2C;
- scoped to one supplier, buyer, delivery, and request group;
- revocable;
- time bounded but with a controlled grace period for late replies;
- never a raw request, supplier, buyer, or user ID.

The outbound email sets this alias as `Reply-To`. The delivery ledger stores the outbound provider message ID and RFC message ID when available.

### Webhook behavior

Extend the signed Resend webhook to accept `email.received`.

The webhook only:

1. verifies the Svix signature over the raw request body;
2. deduplicates using the Svix event ID and Resend email ID;
3. records envelope metadata;
4. queues an inbound processing job;
5. returns HTTP 200 quickly.

Resend's received webhook contains attachment metadata, not attachment bodies. A background processor must retrieve the full email and each attachment using the Receiving API.

## Data model

### `inbound_routing_tokens`

- `id uuid primary key`
- `token_hash text unique not null`
- `delivery_id uuid not null`
- `buyer_id uuid not null`
- `supplier_id uuid not null`
- `request_ids uuid[] not null`
- `status`: `active`, `superseded`, `revoked`, `expired`
- `expires_at`, `grace_until`
- timestamps

### `inbound_email_messages`

- Resend email ID unique
- webhook event ID unique
- RFC `message_id`
- `in_reply_to` and `references` headers
- envelope sender and normalized sender
- recipients, CC, BCC
- subject
- sanitized text body
- separately sanitized HTML body
- raw email object path and SHA-256
- routing token ID
- candidate buyer, supplier, and request IDs
- authentication metadata when available
- match confidence and reasons
- status:
  - `received`
  - `retrieving`
  - `processing`
  - `awaiting_review`
  - `quarantined`
  - `accepted`
  - `partially_accepted`
  - `rejected`
  - `failed`
- quarantine reason and processing error
- provider and processing timestamps

### `inbound_email_attachments`

- message ID and Resend attachment ID
- original filename and sanitized filename
- declared and detected MIME
- content disposition and content ID
- size
- SHA-256
- quarantine storage path
- malware scan state/provider/result
- archive inspection result
- password-protected/encrypted indicator
- duplicate document-asset candidate
- proposed request ID and document type
- AI classification, confidence, and reasons
- review status and final upload/evidence IDs
- timestamps

### `inbound_processing_jobs`

Durable `pending`, `processing`, `retry`, `completed`, `failed`, and `dead_letter` queue with attempts, scheduling, lease expiry, idempotency key, and last error.

### `inbound_review_decisions`

Append-only reviewer decisions:

- reviewer and organization
- message and attachment
- decision: `accept`, `reassign`, `split`, `reject`, `mark_malicious`, `request_clarification`
- selected request and document type
- reason and notes
- before/after match snapshot
- timestamp

## Processing pipeline

### 1. Receive and acknowledge

- Verify webhook signature and replay window.
- Insert the webhook event once.
- Insert the message envelope once by Resend email ID.
- Queue processing once.
- Return before downloading content.

### 2. Retrieve full email

- Retrieve email body, headers, raw email reference, and attachment metadata from Resend.
- Normalize header names but retain the original values.
- Store the raw email in a private immutable provenance bucket.
- Sanitize HTML before any UI rendering.
- Treat remote images, tracking pixels, links, and embedded content as untrusted.

### 3. Resolve sender and route

Routing evidence is evaluated in order:

1. Valid request-specific routing token in the receiving address.
2. `In-Reply-To` or `References` matching an outbound TraceR2C delivery.
3. Exact normalized email belonging to an active supplier owner/member in the candidate supplier.
4. Supplier-domain correlation as supporting evidence only.
5. Subject and body request-number matching as supporting evidence only.
6. AI classification only after deterministic evidence is collected.

AI cannot override a token mismatch, tenant mismatch, revoked relationship, or unknown sender.

Result:

- `matched`: one supplier and one request/group are strongly indicated;
- `ambiguous`: multiple plausible suppliers or requests;
- `unknown`: no trusted supplier identity;
- `suspicious`: token/sender/tenant evidence conflicts.

All four still require review. The last three are quarantined with increasingly restrictive visibility.

### 4. Retrieve and quarantine attachments

- Download using the short-lived Resend attachment URL immediately.
- Enforce per-file, per-message, and decompressed-size limits.
- Stream where possible; never load arbitrarily large content into memory.
- Generate a server-controlled path.
- Calculate SHA-256.
- Detect MIME from file signatures.
- Scan for malware.
- Inspect archives recursively with depth, count, ratio, and decompressed-size limits.
- Detect encrypted/password-protected files and route them to manual handling.
- Separate inline signature images from probable evidence attachments.
- Never copy an unscanned object into the canonical compliance bucket.

### 5. Match attachments to requests

Matching signals:

- signed routing token scope;
- outbound delivery/request relationship;
- active supplier membership;
- open request status;
- requested document type;
- filename and extracted document type;
- buyer/supplier/facility/product identifiers;
- certificate issuer, number, and dates;
- duplicate canonical asset hash;
- request due date and conversation timing.

Each proposed match stores positive and negative reasons. Multiple attachments may map to different requests. Multiple requests may intentionally accept one reusable canonical document, but only after review.

### 6. Human review

Reviewer sees:

- safe-rendered message and sender identity evidence;
- matched outbound conversation;
- requested documents and candidate requests;
- attachment preview from quarantine;
- file hash, scan result, detected MIME, and archive status;
- extracted fields with page/source citations;
- duplicate/reuse candidates;
- AI recommendation and uncertainty;
- every mismatch or warning.

Reviewer actions:

- accept attachment for proposed request;
- assign to another request owned by the same authorized buyer/supplier pair;
- split attachments across requests;
- accept one attachment for multiple eligible requests through canonical reuse;
- reject attachment;
- mark sender/file malicious;
- request clarification from the supplier.

Acceptance uses the same service-only finalization path as portal upload. It creates a normal document upload, canonical evidence candidate, provenance link, activity event, and buyer notification in one controlled operation.

## Unknown sender quarantine

- Unknown messages are invisible to supplier users.
- Only authorized buyer reviewers or platform security roles can inspect them.
- Do not expose candidate company names in automatic responses.
- Do not open links or load remote resources.
- Do not automatically forward the message.
- Rate-limit by sender, domain, IP/provider metadata, recipient alias, and tenant.
- Repeated malicious traffic can revoke the routing token without changing the underlying request.
- A reviewer may associate an unknown sender only after separately establishing supplier identity.

## Edge-case matrix

### Delivery and replay

- duplicate `email.received` webhook;
- webhook replay after successful processing;
- webhook arrives before outbound delivery metadata is committed;
- webhook outage and Resend replay;
- processor crashes after attachment download but before database update;
- expired Resend attachment URL;
- Resend API rate limit or partial response;
- same RFC message delivered through forwarding twice;
- provider email ID differs but message ID/content hash matches.

### Identity and routing

- spoofed `From` address;
- display-name impersonation;
- sender aliases and plus addressing;
- supplier employee changed email;
- former/revoked supplier member replies;
- buyer employee or unrelated third party replies;
- forwarded email changes sender and threading headers;
- shared mailbox sender;
- one supplier connected to multiple buyers;
- token belongs to a different supplier/request;
- expired or revoked token;
- reply to a withdrawn, approved, or superseded request;
- reply arrives during request reassignment;
- subject was edited or localized;
- missing `In-Reply-To` and `References`;
- multiple TraceR2C aliases in To/CC;
- auto-replies, vacation responders, DSNs, and mailer-daemon messages;
- mailing lists and group aliases.

### Attachments

- no attachment;
- only inline logos/signatures;
- zero-byte attachment;
- oversized email or attachment;
- unsupported executable/script;
- extension/MIME/signature mismatch;
- polyglot file;
- infected file;
- scan timeout or scanner unavailable;
- encrypted/password-protected PDF or archive;
- zip bomb, nested archive, path traversal, or excessive file count;
- duplicate attachments in one message;
- same file received in multiple replies;
- duplicate of existing canonical evidence;
- corrupted or truncated file;
- Unicode, control characters, and path separators in filename;
- macro-enabled Office files;
- attachment download URL expires during retry;
- one attachment matches multiple requests;
- multiple attachments match one request;
- attachment is a sample/reference rather than supplier evidence.

### Content and AI

- HTML/script injection;
- tracking pixels and remote content;
- prompt injection inside email or attachment;
- quoted conversation mistaken for new instructions;
- signatures/disclaimers overwhelm actual reply;
- OCR-only scans;
- low-confidence classification;
- conflicting certificate number, issuer, or supplier identity;
- AI suggests another tenant's request;
- different languages and date formats;
- handwritten or rotated scans.

### Review and concurrency

- two reviewers open the same candidate;
- one reviewer accepts while another rejects;
- request is submitted through portal during email review;
- attachment is accepted twice after client retry;
- reviewer assigns to unauthorized supplier/request;
- reviewer accepts a failed/infected scan;
- request due date/status changes during review;
- canonical duplicate is merged while review remains open;
- reviewer loses permission mid-review.

Every case needs a deterministic expected outcome and an automated test where technically feasible.

## Security model

- Webhook endpoint: JWT disabled, mandatory Svix signature verification.
- Retrieval processor: cron/service-role authorization only.
- Review data: RLS by buyer organization and explicit review permission.
- Unknown/suspicious quarantine: narrower security-role policy.
- Storage: separate private provenance and quarantine prefixes/buckets.
- Finalization: service-role-only RPC with explicit verified reviewer actor.
- HTML preview: sanitized and sandboxed; no remote resources.
- Secrets: Resend and scanner credentials remain Supabase secrets/Vault only.
- Logs contain IDs and state transitions, not attachment content or full email bodies.

## Rollout

1. Add `email_reply_ingestion_v1` feature flag, default off.
2. Configure a Resend-managed test inbox first.
3. Extend outbound request emails with request-specific Reply-To aliases.
4. Deploy signed inbound webhook and retrieval queue.
5. Run capture-only mode: store metadata, retrieve nothing.
6. Run quarantine-only mode: retrieve and scan, but create no candidates.
7. Run shadow matching: compare system suggestions with reviewer choices.
8. Enable review acceptance for one buyer/supplier canary.
9. Measure false matches, unknown sender rates, scan failures, and reviewer corrections.
10. Move to the dedicated TraceR2C inbound subdomain.
11. Cohort rollout, then general availability.

## Acceptance gate

Phase 2 is complete only when:

- signed and replay-safe inbound webhooks operate reliably;
- every message and attachment has immutable provider/source provenance;
- no unknown or conflicting sender reaches normal evidence views;
- no unscanned attachment leaves quarantine;
- no inbound email changes request/compliance state without human approval;
- accepted attachments use the same canonical finalization contract as portal uploads;
- duplicate webhook, email, attachment, review, and finalization actions are idempotent;
- cross-tenant, spoofing, archive, malware, prompt-injection, and concurrency tests pass;
- operational dashboards, alerts, retention rules, and recovery runbooks exist.
