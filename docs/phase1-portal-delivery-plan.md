# TraceR2C Phase 1: Portal-First Delivery Plan

## Objective

Complete the portal-first supplier evidence workflow before adding mailbox ingestion or other integrations:

1. Buyers create document requests in TraceR2C.
2. TraceR2C reliably emails the correct supplier recipients through Resend.
3. Each email opens the exact request in the authenticated supplier portal.
4. TraceR2C sends deduplicated reminders until the request is resolved.
5. Suppliers upload evidence through a secure, recoverable, tenant-isolated workflow.

The three features must be delivered sequentially. A feature is not complete until its security, failure, observability, and acceptance gates pass.

## Architectural decisions

- Resend remains the outbound transactional email provider.
- A Resend send response means `provider_accepted`, not `delivered`.
- Resend webhooks are the source of truth for delivered, delayed, bounced, failed, and complained states.
- TraceR2C keeps its own durable delivery ledger. The Resend dashboard is operational backup, not the product record.
- Every recipient gets an individually tracked message. Recipient addresses are never exposed through CC.
- Request creation and delivery enqueueing happen in one database transaction.
- Email processing is asynchronous and retryable, but the first processing attempt is triggered immediately for good UX.
- The portal link requires authentication. A request UUID in a URL is navigation context, not authorization.
- Reminder scheduling is owned by TraceR2C, not by Resend scheduled emails, because request status or due dates can change after scheduling.
- Storage and Postgres cannot participate in one physical transaction. Supplier upload therefore uses an idempotent state machine and reconciliation process to provide transactional behavior.
- New tables are created with RLS and explicit grants because Supabase no longer guarantees that new `public` tables are automatically exposed to the Data API.

## Shared delivery model

### `email_deliveries`

One row per recipient and rendered message.

Core fields:

- `id uuid primary key`
- `buyer_id uuid not null`
- `supplier_id uuid not null`
- `recipient_profile_id uuid null`
- `recipient_email text not null`
- `recipient_name text null`
- `recipient_role text null`
- `message_type text not null`
- `status text not null`
- `provider text not null default 'resend'`
- `provider_message_id text null unique`
- `idempotency_key text not null unique`
- `template_key text not null`
- `template_version integer not null`
- `subject text not null`
- `attempt_count integer not null default 0`
- `next_attempt_at timestamptz null`
- `provider_accepted_at timestamptz null`
- `delivered_at timestamptz null`
- `delayed_at timestamptz null`
- `bounced_at timestamptz null`
- `failed_at timestamptz null`
- `complained_at timestamptz null`
- `opened_at timestamptz null`
- `clicked_at timestamptz null`
- `last_event_at timestamptz null`
- `error_code text null`
- `error_message text null`
- `created_by uuid null`
- `created_at`, `updated_at`
- `metadata jsonb not null default '{}'`

Transport status values:

- `queued`
- `processing`
- `provider_accepted`
- `delivered`
- `delivery_delayed`
- `bounced`
- `failed`
- `complained`
- `suppressed`
- `canceled`

Opened and clicked are engagement timestamps, not transport statuses. They must not replace bounced, failed, or complained states.

### `email_delivery_requests`

Joins a delivery to one or more document requests.

- `delivery_id uuid`
- `request_id uuid`
- `purpose text`: `initial_request`, `pre_due_reminder`, `due_today`, `overdue_reminder`, or `manual_resend`
- `reminder_stage text null`
- `policy_version integer null`
- primary key on `(delivery_id, request_id)`

A uniqueness rule prevents duplicate initial notices and duplicate reminder stages for the same request and recipient. An intentional manual resend creates a new delivery with a new explicit resend reason.

### `email_delivery_events`

Append-only Resend webhook ledger.

- `id uuid primary key`
- `provider text not null`
- `provider_event_id text not null unique`
- `provider_message_id text not null`
- `event_type text not null`
- `event_at timestamptz not null`
- `payload jsonb not null`
- `received_at timestamptz not null`
- `processed_at timestamptz null`

The unique provider event ID makes webhook processing safe under Resend's at-least-once delivery and manual replay behavior.

### Existing `email_audit_logs`

Do not use it as the new state machine. It is too generic and lacks event ordering, deduplication, attempts, and multi-request relationships. Keep it temporarily for legacy follow-up emails, then either expose a compatibility view or migrate remaining senders to the shared delivery service.

## Resend integration contract

### Sending

- Upgrade all request-delivery functions to one pinned current Resend SDK version.
- Store `data.id` as `provider_message_id` when the API accepts an email.
- Pass an idempotency key such as `request-delivery/<email_delivery_id>`.
- Keep TraceR2C's unique database key permanently; Resend only retains idempotency keys for 24 hours.
- Attach Resend tags containing safe identifiers such as `environment`, `message_type`, and `delivery_id`.
- Do not include sensitive document details in tags.
- Use a verified TraceR2C sender such as `TraceR2C <notifications@tracer2c.com>` and a monitored `reply_to` address.
- Render both HTML and plain-text content.

### Webhooks

Create `resend-webhook-v1` with JWT verification disabled only because Resend cannot provide a Supabase user JWT. The function must instead:

1. Read the raw request body without reparsing it first.
2. Verify `svix-id`, `svix-timestamp`, and `svix-signature` using `RESEND_WEBHOOK_SECRET`.
3. Reject invalid or stale signatures.
4. Insert the webhook event using `provider_event_id` uniqueness.
5. Return success for already-recorded events.
6. Update delivery state using the event timestamp, not arrival order.
7. Return quickly so Resend does not unnecessarily retry.

Subscribe to:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.failed`
- `email.complained`
- `email.opened`
- `email.clicked`

### Reconciliation

A scheduled reconciliation job checks old `provider_accepted` or `delivery_delayed` rows that have not received a terminal webhook. It retrieves the Resend email by provider ID and repairs drift. Webhooks remain the primary path; retrieval is the safety net.

## Feature 1: Reliable request delivery

### 1.1 Consolidate request creation and enqueueing

Extend the canonical request-creation RPC, or introduce a replacement RPC, so the same transaction:

1. Validates buyer membership and permissions.
2. Validates each supplier and optional supplier branch.
3. Creates or reuses the document request according to canonical-evidence rules.
4. Resolves supplier recipients server-side.
5. Confirms every created request belongs to that supplier.
6. Snapshots recipients and notification preferences.
7. Creates delivery rows and delivery-request joins.
8. Returns request IDs and delivery IDs.

The browser must never provide trusted recipient addresses or use a caller-supplied `supplier_id` without verifying it against every request.

After the transaction commits, the Edge Function invokes the delivery processor and awaits its response. If the processor is unavailable, the UI reports `Requests created; email queued` instead of falsely reporting that email was sent. Cron retries the durable queue.

### 1.2 Recipient rules

- Supplier owner receives the notice.
- Active supplier company admins receive the notice.
- For branch-specific requests, active users assigned to that supplier branch receive it.
- Duplicate addresses are collapsed case-insensitively.
- Invalid or missing addresses produce a visible `suppressed` delivery state.
- Recipient resolution is shared by single and batch request creation.
- One supplier email may summarize multiple requests, but each recipient has a separate tracked delivery.

Notification preferences:

- Backfill missing `supplier_notification_settings` rows.
- Change the new-supplier default for transactional request email to enabled.
- Keep an explicit opt-out if product policy requires it, but surface `Email disabled by supplier` to the buyer.
- Never treat missing settings as a successful send.

### 1.3 Delivery worker

Create `process-request-email-deliveries-v1`:

- Callable only with a system secret or an authenticated buyer action with server-side authorization.
- Claims queued rows through a database RPC using `FOR UPDATE SKIP LOCKED`.
- Revalidates request status, supplier ownership, recipient state, and email preference immediately before sending.
- Renders a versioned TraceR2C email template.
- Sends with a Resend idempotency key.
- Stores provider ID and `provider_accepted_at`.
- Uses bounded exponential backoff with jitter for retryable failures.
- Does not retry permanent invalid-recipient, hard-bounce, complaint, or configuration failures.
- Moves exhausted attempts to `failed` and creates an actionable buyer notification.

Initial retry policy:

- Immediate
- 1 minute
- 5 minutes
- 30 minutes
- 2 hours
- Then fail and alert

### 1.4 Secure portal deep link

Use a dedicated route:

`/supplier/requests/:requestId`

Behavior:

- Logged-out user is redirected to `/auth` with a relative, allowlisted `returnTo` value.
- `returnTo` survives password login, OAuth if later enabled, and MFA enrollment/challenge.
- Logged-in buyer users cannot enter the supplier upload workflow.
- Logged-in users from another supplier receive a generic not-found/unauthorized screen without request information leakage.
- Valid supplier users land on the exact request with the upload action available.
- Submitted requests show submission status instead of a second blank upload flow.
- Approved or withdrawn requests are read-only.
- Rejected requests open the resubmission flow with reviewer feedback.

No public bearer token is required in Phase 1. Authentication plus request-level authorization provides the security boundary.

### 1.5 Buyer and supplier UX

Buyer request UI shows:

- `Queued`
- `Accepted by email provider`
- `Delivered`
- `Delivery delayed`
- `Bounced`
- `Failed`
- `Supplier disabled email`
- Recipient count and last event time
- `Retry` or `Resend` only when appropriate

Supplier UI shows:

- Buyer name
- Requested documents
- Due dates and priority
- Request instructions and reference samples
- One clear `Upload documents` action
- Existing submission and review state

### 1.6 Feature 1 acceptance gate

- Request creation and delivery enqueue are atomic.
- The UI never says delivered based only on the Resend send response.
- A delivered Resend webhook updates the buyer UI.
- Duplicate function calls do not send duplicate emails.
- Replayed webhooks do not create duplicate events.
- Out-of-order webhook events produce the correct final state.
- Wrong-supplier request IDs are rejected.
- Missing settings and missing recipient addresses are visible failures/suppressions.
- Login and MFA return users to the exact request.
- Cross-tenant portal access is denied.
- Manual resend is permission checked, rate limited, and audited.
- Unit, database/RLS, Edge Function, and Playwright flows pass.
- One canary buyer and supplier complete the flow before general enablement.

## Feature 2: Request reminders

Start only after Feature 1's acceptance gate passes. Reminders reuse the same recipient resolver, template system, delivery ledger, worker, webhooks, and UI statuses.

### 2.1 Reminder policy model

Create `request_reminder_policies`:

- `buyer_id uuid unique`
- `enabled boolean default true`
- `pre_due_days integer[] default '{7,3,1}'`
- `send_due_today boolean default true`
- `overdue_interval_days integer default 7`
- `max_overdue_reminders integer default 4`
- `send_time_local time default '09:00'`
- `timezone text not null`
- `include_weekends boolean default false`
- `policy_version integer`
- timestamps

Requests without a due date do not receive automatic reminders. The buyer UI must require either:

- a due date, or
- an explicit `No due date; automatic reminders disabled` choice.

### 2.2 Reminder scheduler

Create `schedule-request-reminders-v1`, invoked hourly using Supabase Cron and `pg_net`. Store invocation credentials in Supabase Vault.

The scheduler:

1. Selects eligible requests in `pending` or an explicitly reminder-eligible rejected state.
2. Evaluates the buyer's timezone and policy.
3. Determines the reminder stage.
4. Resolves current recipients.
5. Inserts delivery rows and joins with uniqueness constraints.
6. Invokes the shared delivery processor.

The scheduler does not send email directly.

### 2.3 Stop and cancellation rules

Before queueing and again before sending, suppress reminders when:

- request is submitted, approved, withdrawn, or canceled;
- supplier relationship is inactive;
- due date has changed and the reminder stage is no longer applicable;
- recipient is inactive or opted out;
- a reminder for that stage and recipient already exists;
- maximum overdue reminders has been reached.

If a supplier uploads while a reminder is queued, the worker marks it `canceled` instead of sending it.

### 2.4 Manual reminders

- Buyer can send a manual reminder from the request or supplier view.
- Server revalidates buyer membership and request ownership.
- Require a reason for force-resending after bounce, complaint, or supplier opt-out.
- Apply a cooldown and per-buyer rate limit.
- Record actor, reason, request IDs, recipients, and result.

### 2.5 Reminder UX

Buyer sees:

- Next scheduled reminder
- Reminder policy applied
- Complete reminder history per request
- Delivered, delayed, bounced, failed, or suppressed status
- Pause reminders for one request
- Change due date and immediately recalculate schedule

Supplier email groups requests from the same buyer when they share the same reminder stage and send window. The portal link opens a filtered request list and supports direct navigation to each request.

### 2.6 Feature 2 acceptance gate

- Every reminder stage is generated at most once per request, recipient, and policy version.
- Timezones and daylight-saving transitions are tested.
- Weekend behavior is deterministic.
- Due-date changes recalculate correctly.
- Uploading immediately stops queued and future reminders.
- Status changes during a worker run do not send stale reminders.
- Manual reminders respect authorization, cooldowns, preferences, and audit requirements.
- Cron credentials are read from Vault; no secrets appear in SQL or logs.
- Scheduler failure, overlapping runs, and retries produce no duplicate email.
- Canary policy runs through at least one pre-due and one overdue scenario before general enablement.

## Feature 3: Transactional supplier upload

Start only after Feature 2's acceptance gate passes.

### 3.1 Upload state machine

Create `supplier_upload_sessions`:

- `id uuid primary key`
- `request_id uuid not null`
- `supplier_id uuid not null`
- `uploader_id uuid not null`
- `status text not null`
- `idempotency_key text not null unique`
- `quarantine_path text not null unique`
- `final_path text null unique`
- `original_file_name text not null`
- `declared_mime_type text null`
- `detected_mime_type text null`
- `file_size bigint null`
- `sha256 text null`
- `scan_status text not null`
- `scan_provider text null`
- `scan_result jsonb null`
- `expiration_date date null`
- `no_expiration boolean not null`
- `metadata jsonb not null default '{}'`
- `error_code`, `error_message`
- `expires_at`, `created_at`, `updated_at`, `completed_at`

Session states:

- `initiated`
- `uploaded`
- `verifying`
- `scanning`
- `finalizing`
- `completed`
- `failed`
- `expired`
- `canceled`

### 3.2 Begin upload

Create `create-supplier-upload-session-v1`:

1. Authenticate the supplier user.
2. Verify active membership in the request's supplier and branch scope.
3. Verify request status permits a new upload or resubmission.
4. Validate metadata and file constraints.
5. Create an upload session with an immutable server-generated key.
6. Return a short-lived signed upload URL for a private quarantine bucket.

The browser does not choose arbitrary storage paths. Remove the broad authenticated insert policy from `compliance-documents` after all upload callers are migrated.

Suggested path:

`<supplier_id>/<request_id>/<upload_session_id>/<sanitized_file_name>`

### 3.3 Validate and finalize

Create `finalize-supplier-upload-v1`:

1. Authenticate and verify session ownership.
2. Lock the upload session and request.
3. Return the existing result if already completed.
4. Verify the object exists at the exact quarantine path.
5. Enforce non-zero size and maximum size.
6. Detect MIME from file content and compare it with allowed formats.
7. Calculate SHA-256.
8. Run malware scanning; do not mark the request submitted until the object is clean.
9. Move/copy the clean object to an immutable final path.
10. Call one database RPC that atomically:
    - revalidates supplier and request ownership;
    - allocates the next upload version safely;
    - inserts `document_uploads`;
    - updates `document_requests` to `submitted`;
    - creates or updates canonical evidence/version records;
    - writes activity and buyer-notification outbox rows;
    - marks the upload session completed.
11. Trigger downstream extraction and buyer notification from durable outbox rows.

Because object storage is external to Postgres, a reconciliation job cleans stale quarantine objects, repairs completed sessions missing downstream jobs, and removes unreferenced final objects after failed transactions.

### 3.4 Storage and RLS hardening

- Use a private quarantine bucket and private final bucket or strictly separated prefixes.
- Signed upload URLs are scoped to one immutable object key and expire quickly.
- Supplier users can only create sessions for requests owned by their supplier and permitted branch.
- Supplier users cannot directly insert trusted `document_uploads` or update request status.
- Buyers can only view final objects linked to their own requests.
- Quarantine objects are never exposed to buyers.
- Service-role operations remain inside Edge Functions and private database functions.
- Drop overlapping legacy storage policies after validating all current upload flows.
- Add indexes for every RLS relationship used by request, supplier, branch, and uploader checks.

### 3.5 Upload edge cases

Explicitly test:

- zero-byte files;
- oversize files;
- misleading extensions and MIME mismatch;
- unsupported and executable formats;
- duplicate clicks and network retry;
- two simultaneous uploads for one request;
- request withdrawn during upload;
- supplier membership revoked during upload;
- expired signed upload URL;
- object uploaded but finalize never called;
- storage success followed by database failure;
- malware scan timeout, failure, or positive result;
- duplicate file hash and canonical-evidence reuse;
- resubmission after rejection;
- update-metadata-only flows;
- document-library reuse;
- expiration date versus no-expiration validation;
- branch-specific requests;
- downstream extraction failure after upload completion.

### 3.6 Feature 3 acceptance gate

- No browser code directly changes a request to `submitted`.
- No authenticated user can upload to an arbitrary compliance-document path.
- Repeating finalization returns the same upload and does not create a new version.
- Concurrent finalization cannot create duplicate versions.
- A request becomes submitted only after validation and a clean scan.
- Canonical evidence, activity, and buyer notification are durably scheduled in the same database transaction.
- Orphaned temporary and final objects are reconciled.
- Cross-tenant and cross-branch database and storage tests pass.
- Existing onboarding, renewal, template, library, and resubmission upload flows are migrated or explicitly isolated before the broad legacy policy is removed.
- Canary supplier completes upload, resubmission, buyer review, and canonical-evidence verification.

## Testing strategy

### Database tests

- pgTAP for authorization helpers, queue claims, deduplication, state transitions, reminder evaluation, upload versioning, and RLS.
- Separate buyer, supplier owner, supplier admin, branch user, wrong-tenant user, and unauthenticated fixtures.
- Transaction rollback tests for request creation plus delivery enqueue and upload finalization.

### Edge Function tests

- Schema validation and method enforcement.
- Invalid JWT and insufficient buyer/supplier membership.
- Resend success, retryable error, permanent error, timeout, and malformed response.
- Valid, invalid, stale, duplicate, replayed, and out-of-order webhook events.
- Upload session replay, object mismatch, scan failures, and reconciliation.

### Browser tests

- Buyer creates one request and a multi-document batch.
- Logged-out supplier follows email link through authentication and MFA.
- Logged-in supplier lands on the exact request.
- Wrong supplier cannot discover request details.
- Supplier uploads, retries after network interruption, and sees completion.
- Buyer sees delivery history and submission without manual refresh.
- Reminder stops after upload.

### Provider tests

Use Resend test addresses and a non-production sending domain/environment to validate delivered, bounced, complained, and failure paths. Verify the production webhook signing secret separately from development.

## Observability and operations

Metrics:

- queued-to-provider-accepted latency;
- provider-accepted-to-delivered latency;
- delivery, delay, bounce, complaint, and failure rates;
- queue depth and oldest queued message;
- retries and exhausted deliveries;
- reminders created, canceled, and suppressed;
- upload sessions by state and age;
- finalize latency and failure stage;
- orphan objects and reconciliation repairs.

Alerts:

- delivery queue older than five minutes;
- sustained Resend failure or bounce spike;
- webhook endpoint verification failures;
- no webhook events during active sending;
- reminder cron has not completed in its expected window;
- upload sessions stuck in verifying, scanning, or finalizing;
- reconciliation detects cross-record inconsistencies.

Runbooks:

- resend or retry a delivery safely;
- rotate `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET`;
- replay a Resend webhook;
- recover from reminder cron failure;
- reconcile stuck upload sessions and orphan objects;
- disable each feature flag without losing queued work.

## Rollout sequence

### Foundation

- Add feature flags: `reliable_request_delivery_v1`, `request_reminders_v1`, and `transactional_supplier_upload_v1`.
- Add shared delivery tables, RLS, explicit grants, indexes, worker, webhook, and observability.
- Backfill supplier notification settings.
- Keep legacy functions available during comparison, but prevent double sending.

### Feature 1 rollout

1. Local/database tests.
2. Development Resend webhook and test-recipient validation.
3. One buyer/supplier canary.
4. Compare request counts against delivery rows daily.
5. Enable for a small buyer cohort.
6. General enablement.
7. Retire `send-new-request-email` and `send-batch-request-email` after a stable observation window.

### Feature 2 rollout

1. Dry-run scheduler that records proposed reminders without sending.
2. Review proposed sends for seven days or a representative accelerated test window.
3. Canary buyer with controlled due dates.
4. Enable actual sends for the canary.
5. Cohort rollout, then general enablement.

### Feature 3 rollout

1. Add session workflow while legacy upload remains behind its flag.
2. Canary the standard request upload path.
3. Migrate resubmission and library-reuse flows.
4. Migrate onboarding, renewal, template, and other callers using the same bucket.
5. Remove broad legacy storage policies.
6. Run security advisors and cross-tenant tests.
7. Cohort rollout, then general enablement.

## Definition of Phase 1 complete

Phase 1 is complete only when:

- every request has an auditable delivery outcome per recipient;
- Resend provider acceptance and actual delivery are represented separately;
- request emails open the exact authorized supplier workflow after login/MFA;
- reminders are deterministic, deduplicated, and stop immediately when no longer applicable;
- supplier uploads are tenant-isolated, malware-scanned, idempotent, recoverable, and linked to canonical evidence;
- buyers can see delivery, reminder, and submission history without consulting Resend or Supabase dashboards;
- operational alerts and runbooks cover provider, scheduler, webhook, storage, and database failures;
- all three feature acceptance gates have passed in sequence.
