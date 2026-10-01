import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { createUser, getUserByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export const runtime = "edge";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const existing = await getUserByEmail(db, parsed.data.email);
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await createUser(db, parsed.data.email, passwordHash);

  return NextResponse.json({ ok: true, userId: user.id });
}
