import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/cf";
import { getUserId } from "@/lib/session";
import { confirmMealPhoto, getMealPhotoForUser, logMeal } from "@/lib/db";

export const runtime = "edge";

const itemSchema = z.object({
  foodName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("g"),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  isEstimated: z.boolean().default(true), // false once the user typed an exact weight (spec: exact weight overrides the AI estimate)
  preparation: z.enum(["raw", "cooked", "unspecified"]).default("unspecified"),
});

const schema = z.object({
  photoId: z.string().min(1),
  mealSlot: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const db = getDb();

  // Ownership check BEFORE anything is created — an id belonging to
  // another user's photo must fail here, not after a meal has already
  // been written (see Milestone 1 Priority 3: never trust a client-
  // supplied id without verifying it belongs to the caller).
  const photo = await getMealPhotoForUser(db, userId, parsed.data.photoId);
  if (!photo) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const loggedAt = new Date().toISOString();

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
      preparation: i.preparation === "unspecified" ? null : i.preparation,
    }))
  );

  await confirmMealPhoto(db, userId, parsed.data.photoId, meal.id);

  return NextResponse.json({ ok: true, meal });
}
