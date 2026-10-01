"use client";

import { useState } from "react";
import { StatBar, CalorieRing } from "./Card";
import type { Dictionary } from "@/i18n/he";

interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Target {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * Tracking-depth in one place: minimal shows calories + protein only (with
 * a toggle to reveal the rest — the data underneath is never hidden, only
 * the default view is smaller, per the spec's "surfaced by default, not
 * whether it exists" rule). Balanced shows all four, as before. Detailed
 * shows all four plus a %-of-calories breakdown that isn't shown anywhere
 * else in the app today.
 */
export default function MacroSummary({
  t,
  totals,
  target,
  trackingDepth,
}: {
  t: Dictionary;
  totals: Totals;
  target: Target | null;
  trackingDepth: "minimal" | "balanced" | "detailed";
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = trackingDepth !== "minimal" || expanded;

  const caloriesForPct = Math.max(totals.calories, 1);

  return (
    <div className="space-y-4">
      <CalorieRing
        consumed={totals.calories}
        target={target?.calories_kcal ?? 0}
        label={t.calories}
        remainingLabel={totals.calories > (target?.calories_kcal ?? 0) ? t.overTarget : t.remaining}
        unit=""
      />

      <div className="space-y-3">
        <StatBar label={t.protein} consumed={totals.protein} target={target?.protein_g ?? 0} unit="g" metric="protein" />

        {showAll && (
          <>
            <StatBar label={t.carbs} consumed={totals.carbs} target={target?.carbs_g ?? 0} unit="g" metric="carbs" />
            <StatBar label={t.fat} consumed={totals.fat} target={target?.fat_g ?? 0} unit="g" metric="fat" />
          </>
        )}
      </div>

      {trackingDepth === "minimal" && (
        <button onClick={() => setExpanded((e) => !e)} className="text-xs text-accent font-medium">
          {expanded ? t.hideMacros : t.showMacros}
        </button>
      )}

      {trackingDepth === "detailed" && totals.calories > 0 && (
        <p className="text-xs text-muted pt-1">
          {t.macroBreakdownDetailed}: {t.protein}{" "}
          {Math.round(((totals.protein * 4) / caloriesForPct) * 100)}% · {t.carbs}{" "}
          {Math.round(((totals.carbs * 4) / caloriesForPct) * 100)}% · {t.fat}{" "}
          {Math.round(((totals.fat * 9) / caloriesForPct) * 100)}%
        </p>
      )}
    </div>
  );
}

