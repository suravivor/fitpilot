import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { addWeightEntry, completeOnboarding, createGoal, setNutritionTarget, updateProfile } from "@/lib/db";
import { calculateBaselinePlan, type Sex } from "@/lib/nutrition";

export const runtime = "edge";

const schema = z.object({
  goalType: z.enum(["weight_loss", "muscle_gain", "recomposition", "maintenance"]),
  currentWeightKg: z.number().positive(),
  targetWeightKg: z.number().positive().optional(),
  heightCm: z.number().positive(),
  age: z.number().int().positive(),
  sex: z.enum(["male", "female", "other"]).default("other"),
  trackingDepth: z.enum(["minimal", "balanced", "detailed"]).default("balanced"),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const data = parsed.data;
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Profile — baseline facts (§11)
  await updateProfile(db, userId, {
    age: data.age,
    height_cm: data.heightCm,
    sex: data.sex,
    tracking_depth: data.trackingDepth,
  });

  // 2. Baseline weight entry, user-reported (§7 provenance)
  await addWeightEntry(db, userId, data.currentWeightKg, today, {
    source: "REPORTED",
    confidence: "HIGH",
    note: "Onboarding baseline",
  });

  // 3. Goal (§12 temporal goals)
  await createGoal(db, userId, {
    goal_type: data.goalType,
    target_value: data.targetWeightKg ?? null,
    unit: "kg",
    target_waist_cm: null,
    start_date: today,
    target_date: null,
    source: "REPORTED",
    confidence: "HIGH",
    notes: null,
  });

  // 4. Initial nutrition target — deterministic calc (§54), framed as an
  // AI-inferred estimate the user can revise, not a medical prescription.
  const plan = calculateBaselinePlan({
    weightKg: data.currentWeightKg,
    heightCm: data.heightCm,
    age: data.age,
    sex: data.sex as Sex,
    goalType: data.goalType,
  });

  await setNutritionTarget(db, userId, {
    calories_kcal: plan.calories,
    protein_g: plan.protein,
    carbs_g: plan.carbs,
    fat_g: plan.fat,
    source: "ESTIMATED",
    confidence: "MEDIUM",
    approved: true, // baseline target from onboarding doesn't need a separate approval step
  });

  await completeOnboarding(db, userId);

  return NextResponse.json({ ok: true, plan });
}
