-- FitPilot — Milestone 1 schema
-- Every meaningful datapoint carries provenance (source / status / confidence)
-- per the product spec's Data Provenance and Historical Data principles.
-- Nothing here silently overwrites history: weight, goals and nutrition
-- targets are append-only logs, not single mutable rows.

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────
-- USERS & PROFILE
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- nanoid
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  locale TEXT NOT NULL DEFAULT 'he',   -- 'he' | 'en' — user-controlled, Settings > Language
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per user. Fields that change over time (weight, goals) live in
-- their own append-only tables below, NOT here — this is current-state only.
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER,
  height_cm REAL,
  sex TEXT,                            -- optional, only if relevant to calculations
  units TEXT NOT NULL DEFAULT 'metric',-- 'metric' | 'imperial'
  timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
  tracking_depth TEXT NOT NULL DEFAULT 'balanced', -- 'minimal' | 'balanced' | 'detailed'
  onboarding_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────
-- GOALS (temporal — see spec §12: goals have status, never get silently
-- overwritten by a newer goal)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,             -- 'weight_loss' | 'muscle_gain' | 'recomposition' | 'maintenance' | 'custom'
  target_value REAL,
  unit TEXT,
  target_waist_cm REAL,
  start_date TEXT NOT NULL,
  target_date TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | COMPLETED | PAUSED | ABANDONED | HISTORICAL | PENDING_CONFIRMATION
  source TEXT NOT NULL DEFAULT 'REPORTED', -- VERIFIED | REPORTED | ESTIMATED | AI_INFERRED
  confidence TEXT NOT NULL DEFAULT 'HIGH', -- HIGH | MEDIUM | LOW
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_goals_user ON goals(user_id, status);

-- ─────────────────────────────────────────────────────────────────────────
-- WEIGHT & MEASUREMENTS (append-only; trend is computed, never stored as truth)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE weight_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value_kg REAL NOT NULL,
  measured_at TEXT NOT NULL,           -- date of the measurement
  source TEXT NOT NULL DEFAULT 'REPORTED',
  confidence TEXT NOT NULL DEFAULT 'HIGH',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_weight_user_date ON weight_entries(user_id, measured_at);

CREATE TABLE body_measurements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measurement_type TEXT NOT NULL,      -- 'waist' | 'chest' | 'arm' | 'thigh' | 'hip' | custom
  value_cm REAL NOT NULL,
  measured_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'REPORTED',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_measurements_user ON body_measurements(user_id, measurement_type, measured_at);

-- ─────────────────────────────────────────────────────────────────────────
-- NUTRITION TARGETS (append-only — a new target does not erase the old one;
-- changes require the recommendation → approval flow, §39/§55)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE nutrition_targets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calories_kcal INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,                   -- NULL = currently active
  source TEXT NOT NULL DEFAULT 'AI_INFERRED',
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  approved_by_user INTEGER NOT NULL DEFAULT 0, -- 0/1 — set true only via approval gate
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_nutrition_targets_user ON nutrition_targets(user_id, effective_from);

-- ─────────────────────────────────────────────────────────────────────────
-- FOOD & MEALS
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE food_items (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = shared/global food
  name TEXT NOT NULL,
  default_unit TEXT NOT NULL DEFAULT 'g',
  calories_per_100 REAL NOT NULL,
  protein_per_100 REAL NOT NULL,
  carbs_per_100 REAL NOT NULL,
  fat_per_100 REAL NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_food_items_user ON food_items(user_id, name);

CREATE TABLE meals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_at TEXT NOT NULL,             -- when the meal was eaten
  meal_slot TEXT,                      -- 'breakfast' | 'lunch' | 'dinner' | 'snack' | NULL
  source TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL | PHOTO_AI (phase 2) | TEMPLATE
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meals_user_date ON meals(user_id, logged_at);

CREATE TABLE meal_items (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_item_id TEXT REFERENCES food_items(id),
  food_name TEXT NOT NULL,             -- denormalized so history survives food_item edits
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  calories_kcal REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'HIGH',
  is_estimated INTEGER NOT NULL DEFAULT 0, -- 0 = user-confirmed exact, 1 = estimate
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meal_items_meal ON meal_items(meal_id);

-- ─────────────────────────────────────────────────────────────────────────
-- CHECK-INS
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE check_ins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date TEXT NOT NULL,
  energy_level INTEGER,                -- 1-5
  sleep_quality INTEGER,               -- 1-5
  stress_level INTEGER,                -- 1-5
  hunger_level INTEGER,                -- 1-5
  training_completion_pct INTEGER,
  nutrition_adherence_pct INTEGER,
  free_text_feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_checkins_user ON check_ins(user_id, week_start_date);

-- ─────────────────────────────────────────────────────────────────────────
-- AI INSIGHTS / RECOMMENDATIONS (Recommendation → Approval → Action, §55)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE ai_insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,          -- 'daily_summary' | 'recommendation' | 'weekly_review'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_used TEXT,                      -- JSON snapshot of inputs, for auditability
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  requires_approval INTEGER NOT NULL DEFAULT 0,
  approval_state TEXT NOT NULL DEFAULT 'NONE', -- NONE | PENDING | APPROVED | REJECTED
  user_feedback TEXT,                  -- 'helpful' | 'not_helpful' | 'wrong' | etc, nullable
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_insights_user ON ai_insights(user_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- AUDIT LOG (every approval-gated or meaningful automated change)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                -- 'goal_changed' | 'nutrition_target_changed' | 'recommendation_approved' | ...
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  actor TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'ai' | 'system'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);
