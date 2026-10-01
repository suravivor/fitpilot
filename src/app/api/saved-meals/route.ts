import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { listSavedMeals, saveMealTemplate } from "@/lib/db";

export const runtime = "edge";

const itemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("g"),
  calories_kcal: z.number().min(0),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
});

const schema = z.object({
  name: z.string().min(1),
  kind: z.enum(["favorite", "repeated", "custom"]).default("favorite"),
  items: z.array(itemSchema).min(1),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const db = getDb();
  const savedMeals = await listSavedMeals(db, userId);
  return NextResponse.json({
    savedMeals: savedMeals.map((m) => ({ ...m, items: JSON.parse(m.items_json) })),
  });
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
  const saved = await saveMealTemplate(db, userId, parsed.data.name, parsed.data.kind, parsed.data.items);

  return NextResponse.json({ ok: true, saved });
}
