import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { getOrCreateSettings, updateSettings, updateUserLocale, updateProfile } from "@/lib/db";

export const runtime = "edge";

const schema = z.object({
  locale: z.enum(["he", "en"]).optional(),
  trackingDepth: z.enum(["minimal", "balanced", "detailed"]).optional(),
  notificationsEnabled: z.boolean().optional(),
  proactiveCoachingEnabled: z.boolean().optional(),
  workoutReminders: z.boolean().optional(),
  nutritionReminders: z.boolean().optional(),
  checkinReminders: z.boolean().optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = getDb();
  const settings = await getOrCreateSettings(db, userId);
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const d = parsed.data;

  // Language is a user-controlled setting that must never touch other data
  // (spec §1: "Changing the language must not change or delete any user data").
  if (d.locale) await updateUserLocale(db, userId, d.locale);
  if (d.trackingDepth) await updateProfile(db, userId, { tracking_depth: d.trackingDepth });

  const settingsUpdate: Partial<{
    notifications_enabled: number;
    proactive_coaching_enabled: number;
    workout_reminders: number;
    nutrition_reminders: number;
    checkin_reminders: number;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
  }> = {};
  if (d.notificationsEnabled != null) settingsUpdate.notifications_enabled = d.notificationsEnabled ? 1 : 0;
  if (d.proactiveCoachingEnabled != null)
    settingsUpdate.proactive_coaching_enabled = d.proactiveCoachingEnabled ? 1 : 0;
  if (d.workoutReminders != null) settingsUpdate.workout_reminders = d.workoutReminders ? 1 : 0;
  if (d.nutritionReminders != null) settingsUpdate.nutrition_reminders = d.nutritionReminders ? 1 : 0;
  if (d.checkinReminders != null) settingsUpdate.checkin_reminders = d.checkinReminders ? 1 : 0;
  if (d.quietHoursStart !== undefined) settingsUpdate.quiet_hours_start = d.quietHoursStart;
  if (d.quietHoursEnd !== undefined) settingsUpdate.quiet_hours_end = d.quietHoursEnd;

  await updateSettings(db, userId, settingsUpdate);

  return NextResponse.json({ ok: true });
}
