import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/cf";
import { computeWeightTrend, getProfile, listBodyMeasurements, listWeightEntries } from "@/lib/db";
import { getDictionary, type Locale } from "@/i18n";
import Nav from "@/components/Nav";
import { Card } from "@/components/Card";
import WeightLogger from "@/components/WeightLogger";
import MeasurementLogger from "@/components/MeasurementLogger";
import WeeklyCheckIn from "@/components/WeeklyCheckIn";
import WeeklyReviewCard from "@/components/WeeklyReviewCard";
import WeeklyToolsSection from "@/components/WeeklyToolsSection";

export const runtime = "edge";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const locale = (session.user.locale as Locale) ?? "he";
  const t = getDictionary(locale);
  const db = getDb();

  const profile = await getProfile(db, userId);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const entries = await listWeightEntries(db, userId, 30);
  const trend = computeWeightTrend(entries);
  const trackingDepth = profile.tracking_depth;
  const measurements = trackingDepth === "detailed" ? await listBodyMeasurements(db, userId, 30) : [];

  function measurementTypeLabel(type: string): string {
    switch (type) {
      case "waist":
        return t.waist;
      case "chest":
        return t.chest;
      case "arm":
        return t.arm;
      case "thigh":
        return t.thigh;
      case "hip":
        return t.hip;
      default:
        return type;
    }
  }

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-lg font-bold mb-4">{t.navProgress}</h1>

      <Card className="mb-4">
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
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted text-sm">—</p>
        )}
      </Card>

      <div className="space-y-4">
        <WeightLogger t={t} />
        <MeasurementLogger t={t} />
        <WeeklyToolsSection t={t} trackingDepth={trackingDepth}>
          <WeeklyReviewCard t={t} />
          <WeeklyCheckIn t={t} />
        </WeeklyToolsSection>
      </div>

      {entries.length > 0 && (
        <div className="space-y-2 mt-4">
          {entries.map((e) => (
            <Card key={e.id} className="py-2.5 px-4">
              <div className="flex justify-between text-sm">
                <span>{e.measured_at}</span>
                <span className="font-medium">{e.value_kg} ק״ג</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {trackingDepth === "detailed" && measurements.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-muted mb-2">{t.measurementHistory}</h2>
          <div className="space-y-2">
            {measurements.map((m) => (
              <Card key={m.id} className="py-2.5 px-4">
                <div className="flex justify-between text-sm">
                  <span>
                    {measurementTypeLabel(m.measurement_type)} — {m.measured_at}
                  </span>
                  <span className="font-medium">{m.value_cm} ס״מ</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Nav t={t} active="progress" />
    </main>
  );
}
