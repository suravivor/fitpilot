-- Workout system, body measurements, check-ins, weekly reviews, meal-photo
-- AI, favorite meals, and user-controlled settings (notifications, locale).
-- Extends 0001_init.sql without touching any existing table.

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────
-- EXERCISE LIBRARY (shared, seeded once; user_id NULL = global)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = global library
  name TEXT NOT NULL,
  muscle_groups TEXT,                  -- comma-separated, e.g. 'chest,triceps'
  equipment TEXT,                      -- 'barbell' | 'dumbbell' | 'bodyweight' | 'machine' | 'band' | 'none'
  instructions TEXT,
  common_mistakes TEXT,
  difficulty TEXT DEFAULT 'intermediate', -- 'beginner' | 'intermediate' | 'advanced'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_exercises_user ON exercises(user_id, name);

-- ─────────────────────────────────────────────────────────────────────────
-- WORKOUT PLANS & WORKOUTS (a plan is a template; a workout is one session)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE workout_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal_type TEXT,
  days_per_week INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'USER',  -- 'USER' | 'AI_GENERATED'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_workout_plans_user ON workout_plans(user_id, is_active);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES workout_plans(id) ON DELETE SET NULL,
  name TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_minutes INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_workouts_user_date ON workouts(user_id, started_at);

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id),
  exercise_name TEXT NOT NULL,          -- denormalized, survives exercise edits
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight_kg REAL,
  rir INTEGER,                          -- reps in reserve
  rpe REAL,                             -- rate of perceived exertion
  rest_seconds INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_name);

-- ─────────────────────────────────────────────────────────────────────────
-- BODY MEASUREMENTS already has a table in 0001 (body_measurements) — no
-- change needed here, kept for reference.
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- PROGRESS PHOTOS (metadata only; actual bytes live in R2/an object store —
-- out of scope for Milestone 1, table reserved for that wiring)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE progress_photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taken_at TEXT NOT NULL,
  storage_key TEXT NOT NULL,            -- key/path in object storage
  angle TEXT,                           -- 'front' | 'side' | 'back' | NULL
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_progress_photos_user ON progress_photos(user_id, taken_at);

-- ─────────────────────────────────────────────────────────────────────────
-- WEEKLY CHECK-INS already has check_ins table in 0001. Weekly reviews are
-- just another row in ai_insights (insight_type = 'weekly_review'), so no
-- new table needed — kept consistent with the "don't create tables just
-- for elegance" rule (spec §52).
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- FAVORITE / REPEATED MEALS
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE saved_meals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'favorite', -- 'favorite' | 'repeated' | 'custom'
  items_json TEXT NOT NULL,              -- serialized MealItem[]-shaped data
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_saved_meals_user ON saved_meals(user_id, kind);

-- ─────────────────────────────────────────────────────────────────────────
-- MEAL PHOTOS (Meal Vision — photo → AI estimate → user confirmation)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE meal_photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_id TEXT REFERENCES meals(id) ON DELETE SET NULL, -- set once confirmed & logged
  storage_key TEXT NOT NULL,
  ai_raw_response TEXT,                 -- full model output, for debugging/audit
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | CONFIRMED | DISCARDED
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meal_photos_user ON meal_photos(user_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────
-- USER SETTINGS (notifications, quiet hours — separate from user_profiles
-- so notification prefs can evolve independently of coaching/profile data)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  proactive_coaching_enabled INTEGER NOT NULL DEFAULT 1,
  quiet_hours_start TEXT,               -- 'HH:MM'
  quiet_hours_end TEXT,
  workout_reminders INTEGER NOT NULL DEFAULT 1,
  nutrition_reminders INTEGER NOT NULL DEFAULT 1,
  checkin_reminders INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────
-- FEEDBACK ON AI (spec §60 Feedback Loop)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE ai_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_id TEXT REFERENCES ai_insights(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL, -- 'helpful' | 'not_helpful' | 'wrong' | 'not_relevant' | 'too_aggressive' | 'too_vague' | 'already_knew' | 'dont_recommend_again'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_feedback_user ON ai_feedback(user_id, created_at);
