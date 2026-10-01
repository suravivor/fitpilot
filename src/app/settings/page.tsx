import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/cf";
import { getOrCreateSettings, getProfile } from "@/lib/db";
import { getDictionary, type Locale } from "@/i18n";
import Nav from "@/components/Nav";
import SettingsForm from "@/components/SettingsForm";

export const runtime = "edge";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const locale = (session.user.locale as Locale) ?? "he";
  const t = getDictionary(locale);
  const db = getDb();

  const profile = await getProfile(db, userId);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const settings = await getOrCreateSettings(db, userId);

  return (
    <main className="min-h-screen pb-24 px-4 pt-6 max-w-md mx-auto">
      <h1 className="text-lg font-bold mb-4">{t.settings}</h1>

      <SettingsForm
        t={t}
        initialLocale={locale}
        initialTrackingDepth={profile.tracking_depth}
        initialSettings={{
          notificationsEnabled: settings.notifications_enabled === 1,
          proactiveCoachingEnabled: settings.proactive_coaching_enabled === 1,
          workoutReminders: settings.workout_reminders === 1,
          nutritionReminders: settings.nutrition_reminders === 1,
          checkinReminders: settings.checkin_reminders === 1,
        }}
      />

      <Nav t={t} active="settings" />
    </main>
  );
}
