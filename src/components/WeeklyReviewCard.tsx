"use client";

import { useState } from "react";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

interface Insight {
  id: string;
  title: string;
  body: string;
}

export default function WeeklyReviewCard({ t }: { t: Dictionary }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/coach/weekly-review");
    const data = (await res.json().catch(() => ({}))) as { insight?: Insight };
    setInsight(data.insight ?? null);
    setLoading(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium">{t.weeklyReview}</h2>
        <button onClick={generate} disabled={loading} className="text-xs text-accent font-medium disabled:opacity-60">
          {loading ? t.loading : t.generateReview}
        </button>
      </div>
      {insight && <p className="text-sm leading-relaxed whitespace-pre-line">{insight.body}</p>}
    </Card>
  );
}
