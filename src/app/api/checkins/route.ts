import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { listCheckIns, saveCheckIn } from "@/lib/db";

export const runtime = "edge";

const schema = z.object({
  weekStartDate: z.string().optional(),
  energyLevel: z.number().int().min(1).max(5).nullable().optional(),
  sleepQuality: z.number().int().min(1).max(5).nullable().optional(),
  stressLevel: z.number().int().min(1).max(5).nullable().optional(),
  hungerLevel: z.number().int().min(1).max(5).nullable().optional(),
  trainingCompletionPct: z.number().int().min(0).max(100).nullable().optional(),
  nutritionAdherencePct: z.number().int().min(0).max(100).nullable().optional(),
  freeTextFeedback: z.string().nullable().optional(),
});

function mostRecentMonday(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = getDb();
  const checkIns = await listCheckIns(db, userId);
  return NextResponse.json({ checkIns });
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
  const weekStartDate = parsed.data.weekStartDate ?? mostRecentMonday();
  const checkIn = await saveCheckIn(db, userId, weekStartDate, parsed.data);

  return NextResponse.json({ ok: true, checkIn });
}
