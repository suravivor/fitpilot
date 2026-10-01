import { NextResponse } from "next/server";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { searchFoodItems } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });

  const db = getDb();
  const results = await searchFoodItems(db, userId, q.trim());
  return NextResponse.json({ results });
}
