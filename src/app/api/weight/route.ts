import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { addWeightEntry, computeWeightTrend, listWeightEntries } from "@/lib/db";

export const runtime = "edge";

const schema = z.object({
  valueKg: z.number().positive().max(400),
  measuredAt: z.string().optional(), // 'YYYY-MM-DD', defaults to today
  note: z.string().optional(),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = getDb();
  const entries = await listWeightEntries(db, userId);
  const trend = computeWeightTrend(entries);
  return NextResponse.json({ entries, trend });
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
  const measuredAt = parsed.data.measuredAt ?? new Date().toISOString().slice(0, 10);
  const entry = await addWeightEntry(db, userId, parsed.data.valueKg, measuredAt, {
    source: "REPORTED",
    confidence: "HIGH",
    note: parsed.data.note,
  });

  return NextResponse.json({ ok: true, entry });
}
