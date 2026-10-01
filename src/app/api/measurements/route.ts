import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { addBodyMeasurement, listBodyMeasurements } from "@/lib/db";

export const runtime = "edge";

const schema = z.object({
  type: z.enum(["waist", "chest", "arm", "thigh", "hip"]).or(z.string().min(1)),
  valueCm: z.number().positive().max(300),
  measuredAt: z.string().optional(),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = getDb();
  const measurements = await listBodyMeasurements(db, userId);
  return NextResponse.json({ measurements });
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
  const measuredAt = parsed.data.measuredAt ?? new Date().toISOString().slice(0, 10);
  const entry = await addBodyMeasurement(db, userId, parsed.data.type, parsed.data.valueCm, measuredAt);

  return NextResponse.json({ ok: true, entry });
}
