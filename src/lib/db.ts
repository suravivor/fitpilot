// Data-access layer for FitPilot.
//
// Rules encoded here (from the product spec):
//  - §8 Historical Data: weight, nutrition targets and goals are append-only.
//    "Changing" one means inserting a new row and closing out the old one,
//    never UPDATEing the value in place.
//  - §7 Data Provenance: every insert carries source + confidence.
//  - §51 Auditability: goal/target changes and AI recommendations write to
//    audit_log.
import type { D1Database } from "@cloudflare/workers-types";
import { newId } from "./ids";

export type Provenance = "VERIFIED" | "REPORTED" | "ESTIMATED" | "AI_INFERRED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string;
  age: number | null;
  height_cm: number | null;
  sex: string | null;
  units: string;
  timezone: string;
  tracking_depth: "minimal" | "balanced" | "detailed";
  onboarding_completed_at: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  goal_type: string;
  target_value: number | null;
  unit: string | null;
  target_waist_cm: number | null;
  start_date: string;
  target_date: string | null;
  status: "ACTIVE" | "COMPLETED" | "PAUSED" | "ABANDONED" | "HISTORICAL" | "PENDING_CONFIRMATION";
  source: Provenance;
  confidence: Confidence;
  notes: string | null;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  value_kg: number;
  measured_at: string;
  source: Provenance;
  confidence: Confidence;
  note: string | null;
}

export interface NutritionTarget {
  id: string;
  user_id: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  effective_from: string;
  effective_to: string | null;
  source: Provenance;
  confidence: Confidence;
  approved_by_user: number;
}

export interface Meal {
  id: string;
  user_id: string;
  logged_at: string;
  meal_slot: string | null;
  source: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  food_item_id: string | null;
  food_name: string;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: Confidence;
  is_estimated: number;
  preparation: "raw" | "cooked" | null;
}

export interface AiInsight {
  id: string;
  user_id: string;
  insight_type: string;
  title: string;
  body: string;
  data_used: string | null;
  action_json: string | null;
  confidence: Confidence;
  requires_approval: number;
  approval_state: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

// The only actionable recommendation type implemented in Milestone 1: a
// proposed edit to one field of the active nutrition target. Deliberately
// narrow (not a generic "patch any table" mechanism) so approval can be
// applied and audited precisely — widen this union if/when more
// recommendation kinds are added.
export interface UpdateNutritionTargetFieldAction {
  type: "update_nutrition_target_field";
  field: "calories_kcal" | "protein_g" | "carbs_g" | "fat_g";
  currentValue: number;
  proposedValue: number;
  unit: string;
}

export type RecommendationAction = UpdateNutritionTargetFieldAction;

export type ApprovalResult =
  | { ok: true; state: "APPROVED" | "REJECTED"; alreadyResolved: boolean }
  | { ok: false; error: "NOT_FOUND" | "INVALID_ACTION" };

// ── Users ───────────────────────────────────────────────────────────────

export async function createUser(
  db: D1Database,
  email: string,
  passwordHash: string
): Promise<User> {
  const id = newId("usr");
  await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, locale) VALUES (?, ?, ?, 'he')`
    )
    .bind(id, email.toLowerCase().trim(), passwordHash)
    .run();
  await db
    .prepare(`INSERT INTO user_profiles (user_id) VALUES (?)`)
    .bind(id)
    .run();
  const user = await getUserById(db, id);
  if (!user) throw new Error("User creation failed");
  return user;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const row = await db
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email.toLowerCase().trim())
    .first<User>();
  return row ?? null;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<User>();
  return row ?? null;
}

export async function getProfile(db: D1Database, userId: string): Promise<UserProfile | null> {
  const row = await db
    .prepare(`SELECT * FROM user_profiles WHERE user_id = ?`)
    .bind(userId)
    .first<UserProfile>();
  return row ?? null;
}

export async function updateProfile(
  db: D1Database,
  userId: string,
  fields: Partial<Omit<UserProfile, "user_id">>
): Promise<void> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
  await db
    .prepare(`UPDATE user_profiles SET ${setClause}, updated_at = datetime('now') WHERE user_id = ?`)
    .bind(...values, userId)
    .run();
}

export async function completeOnboarding(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE user_profiles SET onboarding_completed_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?`
    )
    .bind(userId)
    .run();
}

// ── Goals ───────────────────────────────────────────────────────────────

export async function createGoal(
  db: D1Database,
  userId: string,
  goal: Omit<Goal, "id" | "user_id" | "created_at" | "status"> & { status?: Goal["status"] }
): Promise<Goal> {
  // Deactivate previous active goals of the same rough type instead of
  // deleting them — they become HISTORICAL, never erased (§12).
  await db
    .prepare(`UPDATE goals SET status = 'HISTORICAL' WHERE user_id = ? AND status = 'ACTIVE'`)
    .bind(userId)
    .run();

  const id = newId("goal");
  await db
    .prepare(
      `INSERT INTO goals
        (id, user_id, goal_type, target_value, unit, target_waist_cm, start_date, target_date, status, source, confidence, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      goal.goal_type,
      goal.target_value,
      goal.unit,
      goal.target_waist_cm,
      goal.start_date,
      goal.target_date,
      goal.status ?? "ACTIVE",
      goal.source,
      goal.confidence,
      goal.notes
    )
    .run();

  await writeAudit(db, userId, "goal_created", "goal", id, null, JSON.stringify(goal));

  const row = await db.prepare(`SELECT * FROM goals WHERE id = ?`).bind(id).first<Goal>();
  if (!row) throw new Error("Goal creation failed");
  return row;
}

export async function getActiveGoal(db: D1Database, userId: string): Promise<Goal | null> {
  const row = await db
    .prepare(`SELECT * FROM goals WHERE user_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`)
    .bind(userId)
    .first<Goal>();
  return row ?? null;
}

export async function listGoals(db: D1Database, userId: string): Promise<Goal[]> {
  const { results } = await db
    .prepare(`SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(userId)
    .all<Goal>();
  return results ?? [];
}

// ── Weight ──────────────────────────────────────────────────────────────

export async function addWeightEntry(
  db: D1Database,
  userId: string,
  valueKg: number,
  measuredAt: string,
  opts: { source?: Provenance; confidence?: Confidence; note?: string } = {}
): Promise<WeightEntry> {
  const id = newId("wt");
  await db
    .prepare(
      `INSERT INTO weight_entries (id, user_id, value_kg, measured_at, source, confidence, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      valueKg,
      measuredAt,
      opts.source ?? "REPORTED",
      opts.confidence ?? "HIGH",
      opts.note ?? null
    )
    .run();
  const row = await db.prepare(`SELECT * FROM weight_entries WHERE id = ?`).bind(id).first<WeightEntry>();
  if (!row) throw new Error("Weight entry creation failed");
  return row;
}

export async function listWeightEntries(
  db: D1Database,
  userId: string,
  limit = 60
): Promise<WeightEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM weight_entries WHERE user_id = ? ORDER BY measured_at DESC LIMIT ?`
    )
    .bind(userId, limit)
    .all<WeightEntry>();
  return results ?? [];
}

export function computeWeightTrend(entries: WeightEntry[]): {
  latest: number | null;
  sevenDayAvg: number | null;
  weeklyChangeKg: number | null;
} {
  if (entries.length === 0) return { latest: null, sevenDayAvg: null, weeklyChangeKg: null };
  // entries are DESC by date
  const sorted = [...entries].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const latest = sorted[sorted.length - 1].value_kg;
  const last7 = sorted.slice(-7);
  const sevenDayAvg = last7.reduce((s, e) => s + e.value_kg, 0) / last7.length;
  let weeklyChangeKg: number | null = null;
  if (sorted.length >= 8) {
    const prior7 = sorted.slice(-14, -7);
    if (prior7.length > 0) {
      const priorAvg = prior7.reduce((s, e) => s + e.value_kg, 0) / prior7.length;
      weeklyChangeKg = Math.round((sevenDayAvg - priorAvg) * 100) / 100;
    }
  }
  return { latest, sevenDayAvg: Math.round(sevenDayAvg * 100) / 100, weeklyChangeKg };
}

// ── Nutrition targets ──────────────────────────────────────────────────

export async function getActiveNutritionTarget(
  db: D1Database,
  userId: string
): Promise<NutritionTarget | null> {
  const row = await db
    .prepare(
      `SELECT * FROM nutrition_targets WHERE user_id = ? AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1`
    )
    .bind(userId)
    .first<NutritionTarget>();
  return row ?? null;
}

export async function setNutritionTarget(
  db: D1Database,
  userId: string,
  target: Pick<NutritionTarget, "calories_kcal" | "protein_g" | "carbs_g" | "fat_g"> & {
    source?: Provenance;
    confidence?: Confidence;
    approved?: boolean;
  }
): Promise<NutritionTarget> {
  const today = new Date().toISOString().slice(0, 10);
  // Close out any currently-active target instead of overwriting it (§8).
  await db
    .prepare(
      `UPDATE nutrition_targets SET effective_to = ? WHERE user_id = ? AND effective_to IS NULL`
    )
    .bind(today, userId)
    .run();

  const id = newId("nt");
  await db
    .prepare(
      `INSERT INTO nutrition_targets
        (id, user_id, calories_kcal, protein_g, carbs_g, fat_g, effective_from, source, confidence, approved_by_user)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      target.calories_kcal,
      target.protein_g,
      target.carbs_g,
      target.fat_g,
      today,
      target.source ?? "AI_INFERRED",
      target.confidence ?? "MEDIUM",
      target.approved ? 1 : 0
    )
    .run();

  await writeAudit(db, userId, "nutrition_target_changed", "nutrition_target", id, null, JSON.stringify(target));

  const row = await db.prepare(`SELECT * FROM nutrition_targets WHERE id = ?`).bind(id).first<NutritionTarget>();
  if (!row) throw new Error("Nutrition target creation failed");
  return row;
}

// ── Meals ───────────────────────────────────────────────────────────────

export interface NewMealItem {
  food_item_id?: string | null;
  food_name: string;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: Confidence;
  is_estimated?: boolean;
  preparation?: "raw" | "cooked" | null;
}

export async function logMeal(
  db: D1Database,
  userId: string,
  loggedAt: string,
  mealSlot: string | null,
  items: NewMealItem[]
): Promise<Meal> {
  const mealId = newId("meal");
  await db
    .prepare(`INSERT INTO meals (id, user_id, logged_at, meal_slot, source) VALUES (?, ?, ?, ?, 'MANUAL')`)
    .bind(mealId, userId, loggedAt, mealSlot)
    .run();

  const stmts = items.map((item) =>
    db
      .prepare(
        `INSERT INTO meal_items
          (id, meal_id, food_item_id, food_name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g, confidence, is_estimated, preparation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId("mi"),
        mealId,
        item.food_item_id ?? null,
        item.food_name,
        item.quantity,
        item.unit,
        item.calories_kcal,
        item.protein_g,
        item.carbs_g,
        item.fat_g,
        item.confidence ?? "HIGH",
        item.is_estimated ? 1 : 0,
        item.preparation ?? null
      )
  );
  if (stmts.length > 0) await db.batch(stmts);

  const row = await db.prepare(`SELECT * FROM meals WHERE id = ?`).bind(mealId).first<Meal>();
  if (!row) throw new Error("Meal creation failed");
  return row;
}

export async function getMealsForDate(
  db: D1Database,
  userId: string,
  dateStr: string // 'YYYY-MM-DD'
): Promise<Array<Meal & { items: MealItem[] }>> {
  const { results: meals } = await db
    .prepare(
      `SELECT * FROM meals WHERE user_id = ? AND date(logged_at) = ? ORDER BY logged_at ASC`
    )
    .bind(userId, dateStr)
    .all<Meal>();

  const out: Array<Meal & { items: MealItem[] }> = [];
  for (const meal of meals ?? []) {
    const { results: items } = await db
      .prepare(`SELECT * FROM meal_items WHERE meal_id = ? ORDER BY created_at ASC`)
      .bind(meal.id)
      .all<MealItem>();
    out.push({ ...meal, items: items ?? [] });
  }
  return out;
}

/**
 * 7-day average protein intake, counting only days that actually have a
 * logged meal (days with no data don't drag the average toward zero and
 * don't count as "adherence" either way). Used as the deterministic gate
 * for the protein-target recommendation — the model never decides whether
 * a recommendation is warranted, only how to phrase it once the numbers
 * already say so (spec §54).
 */
export async function computeRecentProteinAverage(
  db: D1Database,
  userId: string,
  days = 7
): Promise<{ avgProtein: number | null; daysWithData: number }> {
  const today = new Date();
  let total = 0;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const meals = await getMealsForDate(db, userId, dateStr);
    if (meals.length === 0) continue;
    total += sumMealTotals(meals).protein;
    count += 1;
  }
  return { avgProtein: count > 0 ? Math.round(total / count) : null, daysWithData: count };
}

export function sumMealTotals(meals: Array<Meal & { items: MealItem[] }>) {
  let calories = 0,
    protein = 0,
    carbs = 0,
    fat = 0;
  for (const m of meals) {
    for (const i of m.items) {
      calories += i.calories_kcal;
      protein += i.protein_g;
      carbs += i.carbs_g;
      fat += i.fat_g;
    }
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

// ── Food items (favorites / recents) ──────────────────────────────────

export async function searchFoodItems(db: D1Database, userId: string, query: string) {
  const { results } = await db
    .prepare(
      `SELECT * FROM food_items WHERE (user_id = ? OR user_id IS NULL) AND name LIKE ? ORDER BY is_favorite DESC, name ASC LIMIT 20`
    )
    .bind(userId, `%${query}%`)
    .all();
  return results ?? [];
}

export async function createFoodItem(
  db: D1Database,
  userId: string,
  food: {
    name: string;
    default_unit: string;
    calories_per_100: number;
    protein_per_100: number;
    carbs_per_100: number;
    fat_per_100: number;
  }
) {
  const id = newId("food");
  await db
    .prepare(
      `INSERT INTO food_items (id, user_id, name, default_unit, calories_per_100, protein_per_100, carbs_per_100, fat_per_100)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      food.name,
      food.default_unit,
      food.calories_per_100,
      food.protein_per_100,
      food.carbs_per_100,
      food.fat_per_100
    )
    .run();
  return id;
}

// ── AI Insights ─────────────────────────────────────────────────────────

export async function saveInsight(
  db: D1Database,
  userId: string,
  insight: {
    insight_type: string;
    title: string;
    body: string;
    data_used?: unknown;
    confidence?: Confidence;
    requires_approval?: boolean;
  },
  action?: RecommendationAction
): Promise<AiInsight> {
  const id = newId("ins");
  await db
    .prepare(
      `INSERT INTO ai_insights (id, user_id, insight_type, title, body, data_used, action_json, confidence, requires_approval, approval_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      insight.insight_type,
      insight.title,
      insight.body,
      insight.data_used ? JSON.stringify(insight.data_used) : null,
      action ? JSON.stringify(action) : null,
      insight.confidence ?? "MEDIUM",
      insight.requires_approval ? 1 : 0,
      insight.requires_approval ? "PENDING" : "NONE"
    )
    .run();
  const row = await db.prepare(`SELECT * FROM ai_insights WHERE id = ?`).bind(id).first<AiInsight>();
  if (!row) throw new Error("Insight creation failed");
  return row;
}

export async function getLatestInsight(
  db: D1Database,
  userId: string,
  insightType: string
): Promise<AiInsight | null> {
  const row = await db
    .prepare(
      `SELECT * FROM ai_insights WHERE user_id = ? AND insight_type = ? ORDER BY created_at DESC LIMIT 1`
    )
    .bind(userId, insightType)
    .first<AiInsight>();
  return row ?? null;
}

/**
 * The Approval Gate. This is the ONLY place a recommendation's action is
 * ever applied — and only on explicit approval of a PENDING insight that
 * belongs to the calling user.
 *
 *  - Looks the insight up by (id AND user_id) together, so an id belonging
 *    to another user comes back NOT_FOUND rather than silently matching
 *    zero rows while still reporting success to the caller (the bug in
 *    the previous version of this function).
 *  - Idempotent: calling it again on an already-resolved insight returns
 *    that resolution without writing anything a second time (no double
 *    application, no duplicate audit rows).
 *  - Reject never touches the target — only the insight's own status.
 *  - Approve applies `action_json` (when present) by merging the proposed
 *    field into the currently active nutrition target and inserting a new
 *    target row (never mutating the old one — §8), then writes one audit
 *    record with the real before/after target snapshot.
 */
export async function resolveInsightApproval(
  db: D1Database,
  userId: string,
  insightId: string,
  approve: boolean
): Promise<ApprovalResult> {
  const insight = await db
    .prepare(`SELECT * FROM ai_insights WHERE id = ? AND user_id = ?`)
    .bind(insightId, userId)
    .first<AiInsight>();
  if (!insight) return { ok: false, error: "NOT_FOUND" };

  if (insight.approval_state !== "PENDING") {
    // Already resolved — report the existing state, don't re-apply anything.
    return {
      ok: true,
      state: insight.approval_state as "APPROVED" | "REJECTED",
      alreadyResolved: true,
    };
  }

  if (!approve) {
    await db
      .prepare(`UPDATE ai_insights SET approval_state = 'REJECTED' WHERE id = ? AND user_id = ?`)
      .bind(insightId, userId)
      .run();
    await writeAudit(db, userId, "recommendation_rejected", "ai_insight", insightId, null, null, "user");
    return { ok: true, state: "REJECTED", alreadyResolved: false };
  }

  let beforeJson: string | null = null;
  let afterJson: string | null = null;

  if (insight.action_json) {
    let action: RecommendationAction;
    try {
      action = JSON.parse(insight.action_json);
    } catch {
      return { ok: false, error: "INVALID_ACTION" };
    }

    if (action.type === "update_nutrition_target_field") {
      const current = await getActiveNutritionTarget(db, userId);
      if (!current) return { ok: false, error: "INVALID_ACTION" };

      beforeJson = JSON.stringify(current);
      const nextTarget = await setNutritionTarget(db, userId, {
        calories_kcal: action.field === "calories_kcal" ? action.proposedValue : current.calories_kcal,
        protein_g: action.field === "protein_g" ? action.proposedValue : current.protein_g,
        carbs_g: action.field === "carbs_g" ? action.proposedValue : current.carbs_g,
        fat_g: action.field === "fat_g" ? action.proposedValue : current.fat_g,
        source: "AI_INFERRED",
        confidence: insight.confidence,
        approved: true,
      });
      afterJson = JSON.stringify(nextTarget);
    } else {
      return { ok: false, error: "INVALID_ACTION" };
    }
  }

  await db
    .prepare(`UPDATE ai_insights SET approval_state = 'APPROVED' WHERE id = ? AND user_id = ?`)
    .bind(insightId, userId)
    .run();
  await writeAudit(db, userId, "recommendation_approved", "ai_insight", insightId, beforeJson, afterJson, "user");

  return { ok: true, state: "APPROVED", alreadyResolved: false };
}

// ── Audit log ───────────────────────────────────────────────────────────

export async function writeAudit(
  db: D1Database,
  userId: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  beforeJson: string | null,
  afterJson: string | null = null,
  actor: "user" | "ai" | "system" = "user"
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, before_json, after_json, actor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(newId("audit"), userId, action, entityType, entityId, beforeJson, afterJson, actor)
    .run();
}

// ── Exercises ───────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  muscle_groups: string | null;
  equipment: string | null;
  instructions: string | null;
  common_mistakes: string | null;
  difficulty: string;
}

export async function listExercises(db: D1Database, userId: string): Promise<Exercise[]> {
  const { results } = await db
    .prepare(`SELECT * FROM exercises WHERE user_id IS NULL OR user_id = ? ORDER BY name ASC`)
    .bind(userId)
    .all<Exercise>();
  return results ?? [];
}

// ── Workouts ────────────────────────────────────────────────────────────

export interface Workout {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: string | null;
  started_at: string;
  completed_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rir: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface NewWorkoutSet {
  exerciseId?: string | null;
  exerciseName: string;
  setNumber: number;
  reps?: number | null;
  weightKg?: number | null;
  rir?: number | null;
  rpe?: number | null;
  restSeconds?: number | null;
}

export async function logWorkout(
  db: D1Database,
  userId: string,
  startedAt: string,
  name: string | null,
  sets: NewWorkoutSet[],
  durationMinutes?: number | null
): Promise<Workout> {
  const workoutId = newId("wo");
  await db
    .prepare(
      `INSERT INTO workouts (id, user_id, name, started_at, completed_at, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')`
    )
    .bind(workoutId, userId, name, startedAt, new Date().toISOString(), durationMinutes ?? null)
    .run();

  const stmts = sets.map((s) =>
    db
      .prepare(
        `INSERT INTO workout_sets
          (id, workout_id, exercise_id, exercise_name, set_number, reps, weight_kg, rir, rpe, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId("ws"),
        workoutId,
        s.exerciseId ?? null,
        s.exerciseName,
        s.setNumber,
        s.reps ?? null,
        s.weightKg ?? null,
        s.rir ?? null,
        s.rpe ?? null,
        s.restSeconds ?? null
      )
  );
  if (stmts.length > 0) await db.batch(stmts);

  const row = await db.prepare(`SELECT * FROM workouts WHERE id = ?`).bind(workoutId).first<Workout>();
  if (!row) throw new Error("Workout creation failed");
  return row;
}

export async function listRecentWorkouts(
  db: D1Database,
  userId: string,
  limit = 10
): Promise<Array<Workout & { sets: WorkoutSet[] }>> {
  const { results: workouts } = await db
    .prepare(`SELECT * FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT ?`)
    .bind(userId, limit)
    .all<Workout>();

  const out: Array<Workout & { sets: WorkoutSet[] }> = [];
  for (const w of workouts ?? []) {
    const { results: sets } = await db
      .prepare(`SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY set_number ASC`)
      .bind(w.id)
      .all<WorkoutSet>();
    out.push({ ...w, sets: sets ?? [] });
  }
  return out;
}

/** Last time this exercise was performed — for showing "last time: 3x8 @ 40kg" style progression context. */
export async function getLastPerformance(
  db: D1Database,
  userId: string,
  exerciseName: string
): Promise<WorkoutSet[]> {
  const { results } = await db
    .prepare(
      `SELECT ws.* FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       WHERE w.user_id = ? AND ws.exercise_name = ?
       ORDER BY w.started_at DESC LIMIT 10`
    )
    .bind(userId, exerciseName)
    .all<WorkoutSet>();
  return results ?? [];
}

// ── Body measurements ──────────────────────────────────────────────────

export interface BodyMeasurement {
  id: string;
  user_id: string;
  measurement_type: string;
  value_cm: number;
  measured_at: string;
  source: Provenance;
}

export async function addBodyMeasurement(
  db: D1Database,
  userId: string,
  type: string,
  valueCm: number,
  measuredAt: string
): Promise<BodyMeasurement> {
  const id = newId("meas");
  await db
    .prepare(
      `INSERT INTO body_measurements (id, user_id, measurement_type, value_cm, measured_at, source)
       VALUES (?, ?, ?, ?, ?, 'REPORTED')`
    )
    .bind(id, userId, type, valueCm, measuredAt)
    .run();
  const row = await db
    .prepare(`SELECT * FROM body_measurements WHERE id = ?`)
    .bind(id)
    .first<BodyMeasurement>();
  if (!row) throw new Error("Measurement creation failed");
  return row;
}

export async function listBodyMeasurements(
  db: D1Database,
  userId: string,
  limit = 60
): Promise<BodyMeasurement[]> {
  const { results } = await db
    .prepare(`SELECT * FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT ?`)
    .bind(userId, limit)
    .all<BodyMeasurement>();
  return results ?? [];
}

// ── Check-ins ───────────────────────────────────────────────────────────

export interface CheckIn {
  id: string;
  user_id: string;
  week_start_date: string;
  energy_level: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  hunger_level: number | null;
  training_completion_pct: number | null;
  nutrition_adherence_pct: number | null;
  free_text_feedback: string | null;
  created_at: string;
}

export async function saveCheckIn(
  db: D1Database,
  userId: string,
  weekStartDate: string,
  data: {
    energyLevel?: number | null;
    sleepQuality?: number | null;
    stressLevel?: number | null;
    hungerLevel?: number | null;
    trainingCompletionPct?: number | null;
    nutritionAdherencePct?: number | null;
    freeTextFeedback?: string | null;
  }
): Promise<CheckIn> {
  const id = newId("ci");
  await db
    .prepare(
      `INSERT INTO check_ins
        (id, user_id, week_start_date, energy_level, sleep_quality, stress_level, hunger_level, training_completion_pct, nutrition_adherence_pct, free_text_feedback)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      weekStartDate,
      data.energyLevel ?? null,
      data.sleepQuality ?? null,
      data.stressLevel ?? null,
      data.hungerLevel ?? null,
      data.trainingCompletionPct ?? null,
      data.nutritionAdherencePct ?? null,
      data.freeTextFeedback ?? null
    )
    .run();
  const row = await db.prepare(`SELECT * FROM check_ins WHERE id = ?`).bind(id).first<CheckIn>();
  if (!row) throw new Error("Check-in creation failed");
  return row;
}

export async function getLatestCheckIn(db: D1Database, userId: string): Promise<CheckIn | null> {
  const row = await db
    .prepare(`SELECT * FROM check_ins WHERE user_id = ? ORDER BY week_start_date DESC LIMIT 1`)
    .bind(userId)
    .first<CheckIn>();
  return row ?? null;
}

export async function listCheckIns(db: D1Database, userId: string, limit = 12): Promise<CheckIn[]> {
  const { results } = await db
    .prepare(`SELECT * FROM check_ins WHERE user_id = ? ORDER BY week_start_date DESC LIMIT ?`)
    .bind(userId, limit)
    .all<CheckIn>();
  return results ?? [];
}

// ── Saved / favorite meals ─────────────────────────────────────────────

export interface SavedMeal {
  id: string;
  user_id: string;
  name: string;
  kind: "favorite" | "repeated" | "custom";
  items_json: string;
  use_count: number;
  last_used_at: string | null;
}

export async function saveMealTemplate(
  db: D1Database,
  userId: string,
  name: string,
  kind: "favorite" | "repeated" | "custom",
  items: NewMealItem[]
): Promise<SavedMeal> {
  const id = newId("sm");
  await db
    .prepare(
      `INSERT INTO saved_meals (id, user_id, name, kind, items_json) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, userId, name, kind, JSON.stringify(items))
    .run();
  const row = await db.prepare(`SELECT * FROM saved_meals WHERE id = ?`).bind(id).first<SavedMeal>();
  if (!row) throw new Error("Saved meal creation failed");
  return row;
}

export async function listSavedMeals(db: D1Database, userId: string): Promise<SavedMeal[]> {
  const { results } = await db
    .prepare(`SELECT * FROM saved_meals WHERE user_id = ? ORDER BY use_count DESC, created_at DESC`)
    .bind(userId)
    .all<SavedMeal>();
  return results ?? [];
}

export async function markSavedMealUsed(db: D1Database, mealTemplateId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE saved_meals SET use_count = use_count + 1, last_used_at = datetime('now') WHERE id = ?`
    )
    .bind(mealTemplateId)
    .run();
}

// ── Meal photos (Meal Vision) ──────────────────────────────────────────

export interface MealPhoto {
  id: string;
  user_id: string;
  meal_id: string | null;
  storage_key: string;
  ai_raw_response: string | null;
  status: "PENDING" | "CONFIRMED" | "DISCARDED";
  created_at: string;
}

export async function createMealPhoto(
  db: D1Database,
  userId: string,
  storageKey: string
): Promise<MealPhoto> {
  const id = newId("mp");
  await db
    .prepare(`INSERT INTO meal_photos (id, user_id, storage_key, status) VALUES (?, ?, ?, 'PENDING')`)
    .bind(id, userId, storageKey)
    .run();
  const row = await db.prepare(`SELECT * FROM meal_photos WHERE id = ?`).bind(id).first<MealPhoto>();
  if (!row) throw new Error("Meal photo creation failed");
  return row;
}

export async function setMealPhotoAiResponse(
  db: D1Database,
  photoId: string,
  aiRawResponse: string
): Promise<void> {
  await db
    .prepare(`UPDATE meal_photos SET ai_raw_response = ? WHERE id = ?`)
    .bind(aiRawResponse, photoId)
    .run();
}

/**
 * Ownership-checked lookup — callers must use this (not a bare SELECT by
 * id) before acting on a photoId a client supplied, so an id belonging to
 * another user comes back null instead of being silently actionable.
 */
export async function getMealPhotoForUser(
  db: D1Database,
  userId: string,
  photoId: string
): Promise<MealPhoto | null> {
  const row = await db
    .prepare(`SELECT * FROM meal_photos WHERE id = ? AND user_id = ?`)
    .bind(photoId, userId)
    .first<MealPhoto>();
  return row ?? null;
}

// `user_id` is part of the WHERE clause here too (defense in depth, on top
// of the getMealPhotoForUser ownership check callers are expected to do
// first) — either one alone already stops a cross-user id from confirming
// someone else's photo.
export async function confirmMealPhoto(
  db: D1Database,
  userId: string,
  photoId: string,
  mealId: string
): Promise<void> {
  await db
    .prepare(`UPDATE meal_photos SET status = 'CONFIRMED', meal_id = ? WHERE id = ? AND user_id = ?`)
    .bind(mealId, photoId, userId)
    .run();
}

export async function discardMealPhoto(db: D1Database, userId: string, photoId: string): Promise<void> {
  await db
    .prepare(`UPDATE meal_photos SET status = 'DISCARDED' WHERE id = ? AND user_id = ?`)
    .bind(photoId, userId)
    .run();
}

// ── User settings ──────────────────────────────────────────────────────

export interface UserSettings {
  user_id: string;
  notifications_enabled: number;
  proactive_coaching_enabled: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  workout_reminders: number;
  nutrition_reminders: number;
  checkin_reminders: number;
}

export async function getOrCreateSettings(db: D1Database, userId: string): Promise<UserSettings> {
  let row = await db
    .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
    .bind(userId)
    .first<UserSettings>();
  if (!row) {
    await db.prepare(`INSERT INTO user_settings (user_id) VALUES (?)`).bind(userId).run();
    row = await db
      .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
      .bind(userId)
      .first<UserSettings>();
  }
  if (!row) throw new Error("Settings creation failed");
  return row;
}

export async function updateSettings(
  db: D1Database,
  userId: string,
  fields: Partial<Omit<UserSettings, "user_id">>
): Promise<void> {
  await getOrCreateSettings(db, userId); // ensure row exists
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
  await db
    .prepare(`UPDATE user_settings SET ${setClause}, updated_at = datetime('now') WHERE user_id = ?`)
    .bind(...values, userId)
    .run();
}

export async function updateUserLocale(db: D1Database, userId: string, locale: "he" | "en"): Promise<void> {
  await db.prepare(`UPDATE users SET locale = ?, updated_at = datetime('now') WHERE id = ?`).bind(locale, userId).run();
}

// ── AI feedback (§60 Feedback Loop) ────────────────────────────────────

export async function saveAiFeedback(
  db: D1Database,
  userId: string,
  insightId: string,
  feedback: string
): Promise<void> {
  await db
    .prepare(`INSERT INTO ai_feedback (id, user_id, insight_id, feedback) VALUES (?, ?, ?, ?)`)
    .bind(newId("fb"), userId, insightId, feedback)
    .run();
}
