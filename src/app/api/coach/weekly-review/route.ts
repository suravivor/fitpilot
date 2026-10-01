import { NextResponse } from "next/server";
import { getAi, getDb } from "@/lib/cf";
import { auth } from "@/lib/auth";
import {
  computeWeightTrend,
  getActiveGoal,
  getActiveNutritionTarget,
  getLatestCheckIn,
  listWeightEntries,
  listRecentWorkouts,
  getMealsForDate,
  saveInsight,
  sumMealTotals,
} from "@/lib/db";
import { generateWeeklyReview } from "@/lib/coach";
import type { Locale } from "@/i18n";

export const runtime = "edge";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const locale = (session?.user?.locale as Locale) ?? "he";
  const db = getDb();
  const ai = getAi();

  const [goal, target, weightEntries, checkIn, workouts] = await Promise.all([
    getActiveGoal(db, userId),
    getActiveNutritionTarget(db, userId),
    listWeightEntries(db, userId),
    getLatestCheckIn(db, userId),
    listRecentWorkouts(db, userId, 14),
  ]);

  const weightTrend = computeWeightTrend(weightEntries);

  // Average protein adherence over the last 7 days.
  let proteinRatios: number[] = [];
  if (target) {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const meals = await getMealsForDate(db, userId, dateStr);
      if (meals.length === 0) continue;
      const totals = sumMealTotals(meals);
      proteinRatios.push(totals.protein / target.protein_g);
    }
  }
  const avgProteinPct =
    proteinRatios.length > 0 ? proteinRatios.reduce((a, b) => a + b, 0) / proteinRatios.length : null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const workoutsCompleted = workouts.filter((w) => new Date(w.started_at) >= sevenDaysAgo).length;

  const review = await generateWeeklyReview(ai, {
    locale,
    goalType: goal?.goal_type ?? null,
    weightTrend,
    workoutsCompleted,
    workoutsPlanned: null,
    avgProteinPct,
    checkIn: checkIn
      ? {
          energyLevel: checkIn.energy_level,
          sleepQuality: checkIn.sleep_quality,
          stressLevel: checkIn.stress_level,
          hungerLevel: checkIn.hunger_level,
          freeTextFeedback: checkIn.free_text_feedback,
        }
      : null,
  });

  const saved = await saveInsight(db, userId, {
    insight_type: "weekly_review",
    title: review.title,
    body: review.body,
    data_used: { weightTrend, workoutsCompleted, avgProteinPct, checkIn },
    confidence: "MEDIUM",
    requires_approval: false,
  });

  return NextResponse.json({ insight: saved });
}
