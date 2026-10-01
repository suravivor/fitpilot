import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/cf";
import { getActiveNutritionTarget, getMealsForDate, getProfile, sumMealTotals } from "@/lib/db";
import { getDictionary, type Locale } from "@/i18n";
import Nav from "@/components/Nav";
import { Card } from "@/components/Card";
import MacroSummary from "@/components/MacroSummary";
import MealLogger from "@/components/MealLogger";
import MealPhotoLogger from "@/components/MealPhotoLogger";

export const runtime = "edge";

function mealSlotLabel(slot: string | null, t: ReturnType<typeof getDictionary>) {
  switch (slot) {
    case "breakfast":
      return t.breakfast;
    case "lunch":
      return t.lunch;
    case "dinner":
      return t.dinner;
    case "snack":
      return t.snack;
    default:
      return "—";
  }
}

export default async function NutritionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const locale = (session.user.locale as Locale) ?? "he";
  const t = getDictionary(locale);
  const db = getDb();

  const profile = await getProfile(db, userId);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const target = await getActiveNutritionTarget(db, userId);
  const today = new Date().toISOString().slice(0, 10);
  const meals = await getMealsForDate(db, userId, today);
  const totals = sumMealTotals(meals);

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-lg font-bold mb-4">{t.navNutrition}</h1>

      <Card className="mb-4">
        <MacroSummary t={t} totals={totals} target={target} trackingDepth={profile.tracking_depth} />
      </Card>

      {meals.length > 0 && (
        <div className="space-y-2 mb-4">
          {meals.map((meal) => (
            <Card key={meal.id}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{mealSlotLabel(meal.meal_slot, t)}</span>
                <span className="text-xs text-muted">
                  {new Date(meal.logged_at).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <ul className="space-y-1">
                {meal.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.food_name} —{" "}
                      <span dir="ltr" style={{ unicodeBidi: "isolate" }}>
                        {item.quantity}
                        {item.unit}
                      </span>
                      {item.preparation && (
                        <span className="text-muted text-xs">
                          {" · "}
                          {item.preparation === "raw" ? t.prepRaw : t.prepCooked}
                        </span>
                      )}
                      {item.is_estimated === 1 && (
                        <span className="text-muted text-xs"> ({t.estimatedValue})</span>
                      )}
                    </span>
                    <span className="text-muted" dir="ltr" style={{ unicodeBidi: "isolate" }}>
                      {Math.round(item.calories_kcal)} kcal
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <MealPhotoLogger t={t} />
        <MealLogger t={t} />
      </div>

      <Nav t={t} active="nutrition" />
    </main>
  );
}
