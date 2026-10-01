import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { resolveInsightApproval } from "@/lib/db";

export const runtime = "edge";

const schema = z.object({
  insightId: z.string().min(1),
  approve: z.boolean(),
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
  const result = await resolveInsightApproval(db, userId, parsed.data.insightId, parsed.data.approve);

  if (!result.ok) {
    // NOT_FOUND covers both "doesn't exist" and "belongs to another user" —
    // deliberately not distinguished, so a client can't use this endpoint to
    // probe which insight ids exist for other accounts.
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, state: result.state, alreadyResolved: result.alreadyResolved });
}
