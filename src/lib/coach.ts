// AI Coach — uses Cloudflare Workers AI (free tier, included in the `AI`
// binding — no external API key needed). Swap `runCoachModel` for an
// Anthropic client later without touching any caller.
//
// Follows the spec's Personal Context Engine (§34): callers build a small,
// purpose-specific context object instead of dumping the whole DB at the
// model, and the AI Architecture rule (§54): arithmetic happens in plain
// code (db.ts) before the model ever sees the numbers — the model explains,
// it doesn't calculate.
//
// `Ai` here is the ambient global type from @cloudflare/workers-types
// (enabled via tsconfig's `types`), matching what `getAi()` in cf.ts returns.

export interface DailyCoachContext {
  locale: "he" | "en";
  goalType: string | null;
  targetCalories: number | null;
  targetProtein: number | null;
  consumedCalories: number;
  consumedProtein: number;
  consumedCarbs: number;
  consumedFat: number;
  weightTrend: { latest: number | null; sevenDayAvg: number | null; weeklyChangeKg: number | null };
  mealCountToday: number;
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

export async function runCoachModel(ai: Ai, systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const response = await ai.run(MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 300,
    });
    // Workers AI text-generation responses are `{ response: string }`.
    const text = (response as { response?: string }).response;
    return text?.trim() ?? "";
  } catch {
    // Fail soft: callers treat "" the same as "model had nothing to add" and
    // fall back to either skipping the insight or a deterministic string —
    // a transient model/binding failure must never 500 the whole route or
    // block a recommendation whose numbers were already decided in code.
    return "";
  }
}

function systemPromptFor(locale: "he" | "en"): string {
  const base =
    "You are FitPilot's coach: concise, honest, non-judgmental, never uses fake certainty, " +
    "never shames the user, avoids generic motivational fluff. You only use the numbers given " +
    "to you in the prompt — never invent data. If something is missing, say so briefly instead " +
    "of guessing. Keep responses to 1-3 short sentences unless asked for more.";
  return locale === "he"
    ? base + " Respond ONLY in natural, conversational Hebrew (not translated-sounding)."
    : base + " Respond in English.";
}

/**
 * A short, contextual insight after the day's data changes (e.g. a meal was
 * logged). Spec §18: patterns → practical actions, not "your protein is low".
 * Returns null when there's nothing meaningfully useful to say — callers
 * must not force an insight every time (§ Coach Integration: "Do not
 * generate an unnecessary coaching message after every meal").
 */
export async function generateDailyInsight(
  ai: Ai,
  ctx: DailyCoachContext
): Promise<{ title: string; body: string } | null> {
  // Deterministic gate BEFORE calling the model: only bother the model when
  // there is something worth saying. This keeps behavior predictable and
  // avoids burning inference on "everything's fine, nothing to add".
  const hasTarget = ctx.targetCalories != null && ctx.targetProtein != null;
  if (!hasTarget || ctx.mealCountToday === 0) return null;

  const proteinRemaining = ctx.targetProtein! - ctx.consumedProtein;
  const caloriesRemaining = ctx.targetCalories! - ctx.consumedCalories;
  const proteinPct = ctx.consumedProtein / ctx.targetProtein!;

  // Only surface an insight for genuinely noteworthy situations.
  const noteworthy =
    proteinPct >= 0.9 || // close to protein goal — worth flagging
    caloriesRemaining < 0 || // over target
    (ctx.weightTrend.weeklyChangeKg != null && Math.abs(ctx.weightTrend.weeklyChangeKg) >= 0.8);

  if (!noteworthy) return null;

  const userPrompt = `
Today's numbers:
- Calories: ${ctx.consumedCalories} consumed / ${ctx.targetCalories} target (${caloriesRemaining} remaining)
- Protein: ${ctx.consumedProtein}g consumed / ${ctx.targetProtein}g target (${proteinRemaining}g remaining)
- Carbs: ${ctx.consumedCarbs}g, Fat: ${ctx.consumedFat}g
- Meals logged today: ${ctx.mealCountToday}
- Weight trend: latest ${ctx.weightTrend.latest ?? "unknown"}kg, 7-day avg ${ctx.weightTrend.sevenDayAvg ?? "unknown"}kg, weekly change ${ctx.weightTrend.weeklyChangeKg ?? "unknown"}kg
- Goal: ${ctx.goalType ?? "not set"}

Write ONE short, specific, useful coaching observation about today so far. No generic praise, no fluff.
`.trim();

  const body = await runCoachModel(ai, systemPromptFor(ctx.locale), userPrompt);
  if (!body) return null;

  return {
    title: ctx.locale === "he" ? "תובנת קוד\"ץ" : "Coach insight",
    body,
  };
}

export interface ProteinRecommendationContext {
  locale: "he" | "en";
  currentTarget: number;
  proposedTarget: number;
  sevenDayAvg: number;
  daysWithData: number;
}

/**
 * Explains a recommendation that the deterministic gate in the caller
 * already decided is warranted (§54: the model explains, it doesn't
 * decide). This never invents the numbers — they're passed in — it only
 * writes the one-sentence "why".
 */
export async function generateProteinRecommendationExplanation(
  ai: Ai,
  ctx: ProteinRecommendationContext
): Promise<string> {
  const userPrompt = `
The user's current protein target is ${ctx.currentTarget}g/day.
Their actual average intake over the last ${ctx.daysWithData} logged days is ${ctx.sevenDayAvg}g/day — consistently below target.
A more realistic target of ${ctx.proposedTarget}g/day is being proposed instead.

Write ONE short, honest sentence explaining why this specific change is being proposed, using only these numbers. No guilt, no fluff, no fake certainty.
`.trim();

  const body = await runCoachModel(ai, systemPromptFor(ctx.locale), userPrompt);
  if (body) return body;

  // Deterministic fallback if the model returns nothing usable — the
  // recommendation itself must never depend on the model succeeding.
  return ctx.locale === "he"
    ? `הממוצע שלך ב-${ctx.daysWithData} הימים האחרונים הוא כ-${ctx.sevenDayAvg} גרם חלבון, מתחת ליעד הנוכחי של ${ctx.currentTarget} גרם.`
    : `Your average over the last ${ctx.daysWithData} logged days is about ${ctx.sevenDayAvg}g protein, below your current ${ctx.currentTarget}g target.`;
}

export interface WeeklyReviewContext {
  locale: "he" | "en";
  goalType: string | null;
  weightTrend: { latest: number | null; sevenDayAvg: number | null; weeklyChangeKg: number | null };
  workoutsCompleted: number;
  workoutsPlanned: number | null;
  avgProteinPct: number | null; // consumed/target average over the week, e.g. 0.92
  checkIn: {
    energyLevel: number | null;
    sleepQuality: number | null;
    stressLevel: number | null;
    hungerLevel: number | null;
    freeTextFeedback: string | null;
  } | null;
}

/**
 * Weekly Coach Review (spec §32): what went well, what changed, what needs
 * attention, what the data suggests, 1-2 priorities for next week. No
 * deterministic gate here — a weekly review always runs once the user asks
 * for it or the week rolls over, but it is still built only from real
 * numbers, never invented ones.
 */
export async function generateWeeklyReview(
  ai: Ai,
  ctx: WeeklyReviewContext
): Promise<{ title: string; body: string }> {
  const lines: string[] = [
    `Goal: ${ctx.goalType ?? "not set"}`,
    `Weight: latest ${ctx.weightTrend.latest ?? "unknown"}kg, weekly change ${ctx.weightTrend.weeklyChangeKg ?? "unknown"}kg`,
    `Workouts completed: ${ctx.workoutsCompleted}${ctx.workoutsPlanned ? ` / ${ctx.workoutsPlanned} planned` : ""}`,
    `Average protein adherence: ${ctx.avgProteinPct != null ? Math.round(ctx.avgProteinPct * 100) + "%" : "unknown"}`,
  ];
  if (ctx.checkIn) {
    lines.push(
      `Check-in — energy: ${ctx.checkIn.energyLevel ?? "n/a"}/5, sleep: ${ctx.checkIn.sleepQuality ?? "n/a"}/5, stress: ${ctx.checkIn.stressLevel ?? "n/a"}/5, hunger: ${ctx.checkIn.hungerLevel ?? "n/a"}/5`
    );
    if (ctx.checkIn.freeTextFeedback) lines.push(`User note: "${ctx.checkIn.freeTextFeedback}"`);
  }

  const userPrompt = `
This week's data:
${lines.join("\n")}

Write a short weekly review with exactly these sections, each 1-2 sentences:
What went well
What needs attention
Priority for next week

No generic motivational language. Base every sentence only on the numbers above.
`.trim();

  const body = await runCoachModel(ai, systemPromptFor(ctx.locale), userPrompt);

  return {
    title: ctx.locale === "he" ? "סיכום שבועי" : "Weekly review",
    body: body || (ctx.locale === "he" ? "אין מספיק נתונים עדיין לסיכום השבוע." : "Not enough data yet for a weekly summary."),
  };
}
