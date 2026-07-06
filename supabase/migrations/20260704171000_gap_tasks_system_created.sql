-- Phase 4: the gap-detection engine creates tasks with no human author.
-- created_by null now explicitly means "system-generated (gap engine)";
-- detect_compliance_gaps_v1 uses that marker to auto-cancel only its own
-- tasks when the underlying gap closes, never human-created ones.
alter table public.compliance_tasks alter column created_by drop not null;
