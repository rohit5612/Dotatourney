-- Default BLAST format engine templates (12-team classic + 10-team variant)

INSERT INTO engine_templates (id, label, description, config)
VALUES
  (
    'a1000000-0000-4000-8000-000000000012',
    'BLAST — 12 teams',
    'Two groups of six · Last Chance · Play-In crossover · Playoffs. Classic BPC BLAST layout.',
    '{"version":2,"presetId":"BLAST-12","teamCount":12,"format":"blast","seriesType":"bo3","groupStage":{"enabled":true,"groupCount":2,"balance":"equal","groupSizes":[6,6],"seedingMode":"seed_order"},"stages":[{"key":"groups","label":"Group Stage","type":"group_round_robin","seriesRuleKey":"blast-group-bo1"},{"key":"last_chance","label":"Last Chance","type":"last_chance","inputs":[{"fromStage":"groups","ranks":[5,6]}]},{"key":"play_in","label":"Play-In","type":"play_in"},{"key":"playoffs","label":"Playoffs","type":"single_elimination","seriesRuleKey":"blast-po-quarterfinal"}],"seriesRules":{"blast-group-bo1":"bo1","blast-lc-quarterfinal":"bo3","blast-lc-semifinal":"bo3","blast-lc-final":"bo3","blast-lc-round":"bo3","blast-mp-semifinal":"bo3","blast-playin-cross":"bo3","blast-po-quarterfinal":"bo3","blast-po-semifinal":"bo3","blast-po-final":"bo5"},"blastPhasePath":"tiered_merged_standings"}'::jsonb
  ),
  (
    'a1000000-0000-4000-8000-000000000010',
    'BLAST — 10 teams',
    'Two groups of five · Last Chance · single-round Play-In · Playoffs.',
    '{"version":2,"presetId":"BLAST-10","teamCount":10,"format":"blast","seriesType":"bo3","groupStage":{"enabled":true,"groupCount":2,"balance":"equal","groupSizes":[5,5],"seedingMode":"seed_order"},"stages":[{"key":"groups","label":"Group Stage","type":"group_round_robin","seriesRuleKey":"blast-group-bo1"},{"key":"last_chance","label":"Last Chance","type":"last_chance","inputs":[{"fromStage":"groups","ranks":[4,5]}]},{"key":"play_in","label":"Play-In","type":"play_in"},{"key":"playoffs","label":"Playoffs","type":"single_elimination","seriesRuleKey":"blast-po-quarterfinal"}],"seriesRules":{"blast-group-bo1":"bo1","blast-lc-quarterfinal":"bo3","blast-lc-semifinal":"bo3","blast-lc-final":"bo3","blast-lc-round":"bo3","blast-playin-semifinal":"bo3","blast-po-quarterfinal":"bo3","blast-po-semifinal":"bo3","blast-po-final":"bo5"},"blastPhasePath":"ten_qf_seconds"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  updated_at = NOW();
