import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { listRecentWorkouts, logWorkout } from "@/lib/db";

export const runtime = "edge";

const setSchema = z.object({
  exerciseId: z.string().nullable().optional(),
  exerciseName: z.string().min(1),
  setNumber: z.number().int().positive(),
  reps: z.number().int().min(0).nullable().optional(),
  weightKg: z.number().min(0).nullable().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  rpe: z.number().min(0).max(10).nullable().optional(),
  restSeconds: z.number().int().min(0).nullable().optional(),
});

const schema = z.object({
  name: z.string().nullable().optional(),
  startedAt: z.string().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  sets: z.array(setSchema).min(1),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = getDb();
  const workouts = await listRecentWorkouts(db, userId);
  return NextResponse.json({ workouts });
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const startedAt = parsed.data.startedAt ?? new Date().toISOString();

  const workout = await logWorkout(
    db,
    userId,
    startedAt,
    parsed.data.name ?? null,
    parsed.data.sets,
    parsed.data.durationMinutes ?? null
  );

  return NextResponse.json({ ok: true, workout });
}
