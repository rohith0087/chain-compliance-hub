# Phase 2 Email Intake Operations Runbook

## Safety controls

- Keep `email_reply_ingestion_v1` and `email_reply_ai_shadow_v1` disabled outside an approved canary.
- Never move an attachment from `inbound-email-quarantine` unless its scan status is `clean` and a human accepts it.
- Never associate an unknown sender from domain similarity alone.

## Webhook failure or replay

1. Confirm `resend-webhook-v1` signature failures in Edge logs.
2. Verify `RESEND_WEBHOOK_SECRET_CURRENT`; retain the previous secret during rotation.
3. Replay the event from Resend. Provider event ID and email ID uniqueness make replay idempotent.
4. Confirm one message and one processing job exist for the Resend email ID.

## Stalled or dead-letter processing

1. Open Platform Admin → Email Intake.
2. Inspect `last_error`, attempts, sender classification and scanner availability.
3. Fix the external dependency before resetting a dead-letter job to `retry`.
4. Never bypass scanning to clear the queue.

## Scanner outage

1. Leave the feature enabled only for capture/quarantine if approved by operations.
2. Attachments must remain `failed` or pending in quarantine.
3. Restore the private scanner and retry jobs; do not download files to analyst devices.

## Token abuse or sender conflict

1. Set the routing token to `revoked` and record the incident reference.
2. Do not reply to unknown, conflicting, automated or malicious senders.
3. Send a new request/correction delivery to produce a new coded reply address.

## Rejection delivery failure

1. Check the delivery ledger and Resend event history.
2. If the address hard-bounced or complained, keep it suppressed.
3. Select another verified supplier identity and enqueue a new correction delivery.
4. The in-app correction notification remains the source of truth.

## Retention and legal hold

- Accepted provenance: seven years or the configured evidence policy, whichever is longer.
- Rejected clean content: 90 days.
- Unknown or malicious content: 30 days.
- Set legal hold before an investigation. Cleanup retains hashes, metadata and decisions after content deletion.
