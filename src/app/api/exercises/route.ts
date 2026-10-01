import { NextResponse } from "next/server";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { listExercises } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = getDb();
  const exercises = await listExercises(db, userId);
  return NextResponse.json({ exercises });
}
