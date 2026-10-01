-- Milestone 1 gap closure.
--
-- 1. meal_items.preparation — raw/cooked distinction captured at confirm
--    time (spec: "do not mix nutritional reference values incorrectly").
--    We don't have a raw-vs-cooked reference table, so this column exists
--    to correctly RECORD what the user says the measurement was, not to
--    auto-convert between the two — inventing a conversion factor would be
--    exactly the kind of incorrect mixing the spec warns against.
--
-- 2. ai_insights.action_json — the concrete, structured change a
--    recommendation proposes (e.g. "set nutrition_targets.protein_g to
--    150"), separate from data_used (which is the evidence that informed
--    it). This is what the Approval Gate applies on approve, and is NULL
--    for insights that are purely informational (daily/weekly narrative).

ALTER TABLE meal_items ADD COLUMN preparation TEXT; -- 'raw' | 'cooked' | NULL (unspecified)
ALTER TABLE ai_insights ADD COLUMN action_json TEXT; -- JSON action payload, NULL if not actionable
