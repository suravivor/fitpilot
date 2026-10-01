import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { saveAiFeedback } from "@/lib/db";

export const runtime = "edge";

const schema = z.object({
  insightId: z.string().min(1),
  feedback: z.enum([
    "helpful",
    "not_helpful",
    "wrong",
    "not_relevant",
    "too_aggressive",
    "too_vague",
    "already_knew",
    "dont_recommend_again",
  ]),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  await saveAiFeedback(db, userId, parsed.data.insightId, parsed.data.feedback);

  return NextResponse.json({ ok: true });
}
