import { NextResponse } from "next/server";
import { getAi, getDb } from "@/lib/cf";
import { auth } from "@/lib/auth";
import {
  computeRecentProteinAverage,
  computeWeightTrend,
  getActiveGoal,
  getActiveNutritionTarget,
  getLatestInsight,
  getMealsForDate,
  listWeightEntries,
  saveInsight,
  sumMealTotals,
  type AiInsight,
  type UpdateNutritionTargetFieldAction,
} from "@/lib/db";
import { generateDailyInsight, generateProteinRecommendationExplanation } from "@/lib/coach";
import type { Locale } from "@/i18n";

export const runtime = "edge";

const RECOMMENDATION_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // don't re-nag for 3 days after reject/approve
const MIN_DAYS_WITH_DATA = 4; // don't propose off a couple of sparse days
const ADHERENCE_THRESHOLD = 0.85; // "consistently below target"

function shapeInsightForClient(insight: AiInsight) {
  let action: UpdateNutritionTargetFieldAction | null = null;
  if (insight.action_json) {
    try {
      action = JSON.parse(insight.action_json);
    } catch {
      action = null;
    }
  }
  let dataUsed: Record<string, unknown> | null = null;
  if (insight.data_used) {
    try {
      dataUsed = JSON.parse(insight.data_used);
    } catch {
      dataUsed = null;
    }
  }
  return {
    id: insight.id,
    insightType: insight.insight_type,
    title: insight.title,
    body: insight.body,
    requires_approval: insight.requires_approval,
    approval_state: insight.approval_state,
    action,
    dataUsed,
  };
}

/**
 * Generates (or reuses) today's coaching content: either a pending
 * recommendation (if one exists or the deterministic gate below decides
 * one is now warranted) or the plain narrative daily insight — never both,
 * to keep the home screen from stacking coach cards. The gate that decides
 * *whether* a recommendation is warranted is plain code; the model only
 * writes the "why" sentence (spec §54).
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const locale = (session?.user?.locale as Locale) ?? "he";
  const db = getDb();
  const ai = getAi();

  const [goal, target, weightEntries] = await Promise.all([
    getActiveGoal(db, userId),
    getActiveNutritionTarget(db, userId),
    listWeightEntries(db, userId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const meals = await getMealsForDate(db, userId, today);
  const totals = sumMealTotals(meals);
  const weightTrend = computeWeightTrend(weightEntries);

  // ── Recommendation gate ────────────────────────────────────────────
  // A PENDING recommendation, once generated, must keep showing up on
  // every load until the user approves or rejects it — never silently
  // regenerated or replaced while it's awaiting a decision.
  const latestRecommendation = await getLatestInsight(db, userId, "recommendation");
  let recommendation: AiInsight | null =
    latestRecommendation?.approval_state === "PENDING" ? latestRecommendation : null;

  if (!recommendation && target) {
    const recentlyHandled =
      latestRecommendation != null &&
      latestRecommendation.approval_state !== "NONE" &&
      Date.now() - new Date(latestRecommendation.created_at).getTime() < RECOMMENDATION_COOLDOWN_MS;

    if (!recentlyHandled) {
      const { avgProtein, daysWithData } = await computeRecentProteinAverage(db, userId);
      if (avgProtein != null && daysWithData >= MIN_DAYS_WITH_DATA) {
        const ratio = avgProtein / target.protein_g;
        if (ratio <= ADHERENCE_THRESHOLD) {
          // Round to the nearest 5g, but never propose below 70% of the
          // current target — a rough floor so a couple of very bad days
          // can't drag the proposal down to something unreasonable.
          const proposedTarget = Math.max(
            Math.round(avgProtein / 5) * 5,
            Math.round(target.protein_g * 0.7)
          );
          if (proposedTarget > 0 && proposedTarget < target.protein_g) {
            const explanation = await generateProteinRecommendationExplanation(ai, {
              locale,
              currentTarget: target.protein_g,
              proposedTarget,
              sevenDayAvg: avgProtein,
              daysWithData,
            });
            const action: UpdateNutritionTargetFieldAction = {
              type: "update_nutrition_target_field",
              field: "protein_g",
              currentValue: target.protein_g,
              proposedValue: proposedTarget,
              unit: "g",
            };
            recommendation = await saveInsight(
              db,
              userId,
              {
                insight_type: "recommendation",
                title: locale === "he" ? "הצעה לעדכון יעד חלבון" : "Suggestion: update protein target",
                body: explanation,
                data_used: { sevenDayAvg: avgProtein, daysWithData, currentTarget: target.protein_g },
                confidence: "MEDIUM",
                requires_approval: true,
              },
              action
            );
          }
        }
      }
    }
  }

  if (recommendation) {
    return NextResponse.json({ insight: shapeInsightForClient(recommendation) });
  }

  // ── Plain narrative daily insight (no action attached) ─────────────
  const insight = await generateDailyInsight(ai, {
    locale,
    goalType: goal?.goal_type ?? null,
    targetCalories: target?.calories_kcal ?? null,
    targetProtein: target?.protein_g ?? null,
    consumedCalories: totals.calories,
    consumedProtein: totals.protein,
    consumedCarbs: totals.carbs,
    consumedFat: totals.fat,
    weightTrend,
    mealCountToday: meals.length,
  });

  if (!insight) {
    return NextResponse.json({ insight: null });
  }

  const saved = await saveInsight(db, userId, {
    insight_type: "daily_summary",
    title: insight.title,
    body: insight.body,
    data_used: { totals, weightTrend, goalType: goal?.goal_type, target },
    confidence: "MEDIUM",
    requires_approval: false,
  });

  return NextResponse.json({ insight: shapeInsightForClient(saved) });
}
