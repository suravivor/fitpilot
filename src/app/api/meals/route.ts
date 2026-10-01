import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { getMealsForDate, logMeal, sumMealTotals } from "@/lib/db";

export const runtime = "edge";

const itemSchema = z.object({
  foodName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("g"),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  isEstimated: z.boolean().default(true),
});

const schema = z.object({
  loggedAt: z.string().optional(), // ISO datetime, defaults to now
  mealSlot: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
  items: z.array(itemSchema).min(1),
});

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const db = getDb();
  const meals = await getMealsForDate(db, userId, date);
  const totals = sumMealTotals(meals);

  return NextResponse.json({ meals, totals, date });
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
  const loggedAt = parsed.data.loggedAt ?? new Date().toISOString();

  const meal = await logMeal(
    db,
    userId,
    loggedAt,
    parsed.data.mealSlot ?? null,
    parsed.data.items.map((i) => ({
      food_name: i.foodName,
      quantity: i.quantity,
      unit: i.unit,
      calories_kcal: i.calories,
      protein_g: i.protein,
      carbs_g: i.carbs,
      fat_g: i.fat,
      is_estimated: i.isEstimated,
      confidence: i.isEstimated ? "MEDIUM" : "HIGH",
    }))
  );

  return NextResponse.json({ ok: true, meal });
}
