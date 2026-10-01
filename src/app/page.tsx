import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/cf";
import {
  computeWeightTrend,
  getActiveGoal,
  getActiveNutritionTarget,
  getMealsForDate,
  getProfile,
  listWeightEntries,
  sumMealTotals,
} from "@/lib/db";
import { getDictionary, type Locale } from "@/i18n";
import Nav from "@/components/Nav";
import { Card } from "@/components/Card";
import MacroSummary from "@/components/MacroSummary";
import CoachInsight from "@/components/CoachInsight";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";

export const runtime = "edge";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const locale = (session.user.locale as Locale) ?? "he";
  const t = getDictionary(locale);
  const db = getDb();

  const profile = await getProfile(db, userId);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const [goal, target, weightEntries] = await Promise.all([
    getActiveGoal(db, userId),
    getActiveNutritionTarget(db, userId),
    listWeightEntries(db, userId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const meals = await getMealsForDate(db, userId, today);
  const totals = sumMealTotals(meals);
  const trend = computeWeightTrend(weightEntries);

  const status: "on_track" | "needs_attention" | "off_track" = !target
    ? "needs_attention"
    : totals.calories > target.calories_kcal * 1.15
    ? "off_track"
    : totals.protein < target.protein_g * 0.5 && meals.length > 0
    ? "needs_attention"
    : "on_track";

  const statusLabel = { on_track: t.onTrack, needs_attention: t.needsAttention, off_track: t.offTrack }[status];
  const statusColor = {
    on_track: "text-good bg-good/10",
    needs_attention: "text-warn bg-warn/10",
    off_track: "text-bad bg-bad/10",
  }[status];

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold">{t.appName}</h1>
          <p className="text-sm text-muted">{t.whatNow}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${statusColor}`}>{statusLabel}</span>
          <LogoutButton t={t} />
        </div>
      </header>

      <div className="space-y-4">
        <Card>
          <h2 className="text-sm font-medium text-muted mb-3">{t.todayStatus}</h2>
          <MacroSummary t={t} totals={totals} target={target} trackingDepth={profile.tracking_depth} />
        </Card>

        <CoachInsight t={t} trackingDepth={profile.tracking_depth} />

        <Card>
          <h2 className="text-sm font-medium text-muted mb-2">{t.weightTrend}</h2>
          {trend.latest != null ? (
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold">{trend.latest} ק״ג</div>
                <div className="text-sm text-muted">
                  {t.sevenDayAvg}: {trend.sevenDayAvg ?? "—"}
                </div>
              </div>
              {trend.weeklyChangeKg != null && (
                <div
                  className={`text-sm font-medium ${
                    trend.weeklyChangeKg < 0 ? "text-good" : trend.weeklyChangeKg > 0 ? "text-warn" : "text-muted"
                  }`}
                >
                  <span dir="ltr" style={{ unicodeBidi: "isolate" }}>
                    {trend.weeklyChangeKg > 0 ? "+" : ""}
                    {trend.weeklyChangeKg} ק״ג
                  </span>{" "}
                  / {t.weeklyChange}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted text-sm">—</p>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/nutrition"
            className="bg-accent hover:bg-accent-strong text-white rounded-card py-3.5 text-center font-medium"
          >
            {t.logMeal}
          </Link>
          <Link
            href="/progress"
            className="bg-surface border rounded-card py-3.5 text-center font-medium"
          >
            {t.logWeight}
          </Link>
        </div>

        {goal && (
          <p className="text-xs text-muted text-center">
            {t.goalQuestion} {goalLabel(goal.goal_type, t)}
          </p>
        )}
      </div>

      <Nav t={t} active="home" />
    </main>
  );
}

function goalLabel(type: string, t: ReturnType<typeof getDictionary>) {
  switch (type) {
    case "weight_loss":
      return t.goalWeightLoss;
    case "muscle_gain":
      return t.goalMuscleGain;
    case "recomposition":
      return t.goalRecomposition;
    default:
      return t.goalMaintenance;
  }
}
