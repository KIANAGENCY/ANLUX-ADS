begin;

-- Older quality entries have no known start date. Preserve them for audit,
-- but exclude them from exact-period decisions until manually reconciled.
alter table public.campaign_quality_feedback
  add column if not exists period_from date;
alter table public.campaign_quality_feedback
  drop constraint if exists campaign_quality_feedback_ad_account_id_campaign_id_period__key;
alter table public.campaign_quality_feedback
  add constraint campaign_quality_feedback_exact_period_key
  unique (ad_account_id, campaign_id, period_from, period_to, reported_by);

alter table public.decision_history
  add column if not exists result_type text,
  add column if not exists previous_result_type text,
  add column if not exists current_results_available boolean,
  add column if not exists previous_results_available boolean;

-- Do not infer a result type from objective or historical result counts.
-- Fresh Meta reads will populate these fields on the next saved snapshot.
commit;
