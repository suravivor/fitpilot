"use client";

import { useEffect, useState } from "react";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

interface RecommendationAction {
  type: "update_nutrition_target_field";
  field: "calories_kcal" | "protein_g" | "carbs_g" | "fat_g";
  currentValue: number;
  proposedValue: number;
  unit: string;
}

interface Insight {
  id: string;
  insightType: string;
  title: string;
  body: string;
  requires_approval: number;
  approval_state: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  action: RecommendationAction | null;
  dataUsed: Record<string, unknown> | null;
}

type FeedbackValue = "helpful" | "not_helpful";

function fieldLabel(field: RecommendationAction["field"], t: Dictionary): string {
  switch (field) {
    case "calories_kcal":
      return t.calories;
    case "protein_g":
      return t.protein;
    case "carbs_g":
      return t.carbs;
    case "fat_g":
      return t.fat;
  }
}

export default function CoachInsight({
  t,
  trackingDepth = "balanced",
}: {
  t: Dictionary;
  trackingDepth?: "minimal" | "balanced" | "detailed";
}) {
  const [insight, setInsight] = useState<Insight | null>(null);
  // In minimal mode we don't auto-fetch — coaching is opt-in there, so
  // "loading" starts false and a button triggers the same fetch.
  const [loading, setLoading] = useState(trackingDepth !== "minimal");
  const [hasFetchedOnce, setHasFetchedOnce] = useState(trackingDepth !== "minimal");
  const [resolving, setResolving] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackValue | null>(null);
  const [actionOutcome, setActionOutcome] = useState<"approved" | "rejected" | null>(null);

  function fetchInsight() {
    setLoading(true);
    setHasFetchedOnce(true);
    fetch("/api/coach/insight")
      .then((r) => r.json() as Promise<{ insight: Insight | null }>)
      .then((data) => setInsight(data.insight ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (trackingDepth === "minimal") return; // wait for the user to ask
    fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(approve: boolean) {
    if (!insight) return;
    setResolving(true);
    const res = await fetch("/api/coach/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ insightId: insight.id, approve }),
    });
    if (res.ok) {
      setInsight({ ...insight, approval_state: approve ? "APPROVED" : "REJECTED" });
      setActionOutcome(approve ? "approved" : "rejected");
    }
    setResolving(false);
  }

  async function sendFeedback(value: FeedbackValue) {
    if (!insight) return;
    setFeedbackGiven(value);
    await fetch("/api/coach/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ insightId: insight.id, feedback: value }),
    });
  }

  if (!hasFetchedOnce) {
    return (
      <Card>
        <h2 className="text-sm font-medium text-muted mb-2">{t.coachInsight}</h2>
        <button onClick={fetchInsight} className="text-sm text-accent font-medium">
          {t.getInsight}
        </button>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">{t.loading}</p>
      </Card>
    );
  }

  if (!insight) {
    return (
      <Card>
        <h2 className="text-sm font-medium text-muted mb-1">{t.coachInsight}</h2>
        <p className="text-sm text-muted">{t.noInsightYet}</p>
      </Card>
    );
  }

  const isRecommendation = insight.insightType === "recommendation" && insight.action != null;

  return (
    <Card className="border-accent/30">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-lg">🧭</span>
        <h2 className="text-sm font-medium">
          {isRecommendation ? t.recommendationLabel : insight.title}
        </h2>
      </div>

      {isRecommendation && insight.action ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {fieldLabel(insight.action.field, t)}: {insight.action.currentValue}
            {insight.action.unit} → {insight.action.proposedValue}
            {insight.action.unit}
          </p>
          <div>
            <p className="text-xs text-muted">{t.whyLabel}</p>
            <p className="text-sm leading-relaxed">{insight.body}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed">{insight.body}</p>
      )}

      {insight.requires_approval === 1 && insight.approval_state === "PENDING" && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => respond(true)}
            disabled={resolving}
            className="flex-1 bg-accent text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {t.approve}
          </button>
          <button
            onClick={() => respond(false)}
            disabled={resolving}
            className="flex-1 border rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {t.reject}
          </button>
        </div>
      )}

      {insight.approval_state !== "PENDING" && insight.requires_approval === 1 && actionOutcome && (
        <p className="text-xs text-good mt-2">
          {actionOutcome === "approved" ? t.recommendationApplied : t.recommendationRejectedNote}
        </p>
      )}

      {trackingDepth === "detailed" && insight.dataUsed && (
        <details className="mt-3">
          <summary className="text-xs text-accent cursor-pointer">{t.dataUsedLabel}</summary>
          <ul className="text-xs text-muted mt-1 space-y-0.5">
            {Object.entries(insight.dataUsed).map(([key, value]) => (
              <li key={key}>
                {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {!isRecommendation &&
        (!feedbackGiven ? (
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="text-muted">{t.wasThisHelpful}</span>
            <button onClick={() => sendFeedback("helpful")} className="text-accent font-medium">
              {t.helpful}
            </button>
            <button onClick={() => sendFeedback("not_helpful")} className="text-muted font-medium">
              {t.notHelpful}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted mt-3">🙏</p>
        ))}
    </Card>
  );
}
