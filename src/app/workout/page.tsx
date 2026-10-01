import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/cf";
import { getProfile, listRecentWorkouts } from "@/lib/db";
import { getDictionary, type Locale } from "@/i18n";
import Nav from "@/components/Nav";
import { Card } from "@/components/Card";
import WorkoutLogger from "@/components/WorkoutLogger";

export const runtime = "edge";

export default async function WorkoutPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const locale = (session.user.locale as Locale) ?? "he";
  const t = getDictionary(locale);
  const db = getDb();

  const profile = await getProfile(db, userId);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const workouts = await listRecentWorkouts(db, userId, 10);

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-lg font-bold mb-4">{t.navWorkoutFull}</h1>

      <WorkoutLogger t={t} />

      <h2 className="text-sm font-medium text-muted mt-5 mb-2">{t.recentWorkouts}</h2>
      {workouts.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{t.noWorkoutsYet}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {workouts.map((w) => (
            <Card key={w.id}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">{w.name || t.navWorkoutFull}</span>
                <span className="text-xs text-muted">{new Date(w.started_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}</span>
              </div>
              <ul className="space-y-0.5">
                {w.sets.map((s) => (
                  <li key={s.id} className="text-sm flex justify-between">
                    <span>{s.exercise_name}</span>
                    <span className="text-muted">
                      {s.reps ?? "—"} × {s.weight_kg ?? "—"} kg
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Nav t={t} active="workout" />
    </main>
  );
}
