import { NextResponse } from "next/server";
import { getAi, getDb } from "@/lib/cf";
import { auth } from "@/lib/auth";
import { createMealPhoto, setMealPhotoAiResponse } from "@/lib/db";
import type { Locale } from "@/i18n";

export const runtime = "edge";

// Workers AI vision-language model — free tier, no external key. It's not
// as strong as a dedicated food-recognition model, so the prompt asks it
// to be conservative and the response is ALWAYS treated as an estimate the
// user must confirm/edit (spec: "Never present visual estimates as exact
// measurements").
const VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

interface DetectedFood {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  preparation: "raw" | "cooked" | "unspecified";
}

function buildPrompt(locale: Locale): string {
  return (
    "You are a food-photo analysis assistant. Look at this meal photo and identify each distinct food item. " +
    "For each item estimate: name, quantity, unit (prefer grams), calories, protein (g), carbs (g), fat (g), " +
    "a confidence level (HIGH, MEDIUM, or LOW) based on how clearly you can see it, and whether it appears " +
    "raw or cooked (use \"unspecified\" if it doesn't apply, e.g. for a packaged/processed food). " +
    "If you cannot tell the preparation method or exact portion, mark confidence LOW rather than guessing HIGH. " +
    "Respond with ONLY a JSON array, no other text, in this exact shape: " +
    '[{"name": string, "quantity": number, "unit": string, "calories": number, "protein": number, "carbs": number, "fat": number, "confidence": "HIGH"|"MEDIUM"|"LOW", "preparation": "raw"|"cooked"|"unspecified"}]' +
    (locale === "he" ? " Food names should be in Hebrew." : "")
  );
}

function tryParseFoods(raw: string): DetectedFood[] | null {
  try {
    // Model sometimes wraps JSON in prose or code fences — extract the array.
    const match = raw.match(/\[[\s\S]*\]/);
    const jsonStr = match ? match[0] : raw;
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((f) => f && typeof f.name === "string")
      .map((f) => ({
        name: String(f.name),
        quantity: Number(f.quantity) || 0,
        unit: String(f.unit || "g"),
        calories: Number(f.calories) || 0,
        protein: Number(f.protein) || 0,
        carbs: Number(f.carbs) || 0,
        fat: Number(f.fat) || 0,
        confidence: ["HIGH", "MEDIUM", "LOW"].includes(f.confidence) ? f.confidence : "LOW",
        preparation: ["raw", "cooked", "unspecified"].includes(f.preparation) ? f.preparation : "unspecified",
      }));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const locale = (session?.user?.locale as Locale) ?? "he";

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("photo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "NO_PHOTO" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const imageBytes = [...new Uint8Array(arrayBuffer)];

  const db = getDb();
  const ai = getAi();

  // Store a reference (no R2 bucket wired in Milestone 1 — storage_key is a
  // placeholder id; wiring real object storage is a follow-up, not a
  // blocker for proving the analyze → confirm → log loop end to end).
  const photo = await createMealPhoto(db, userId, `pending-r2/${Date.now()}-${file.name}`);

  let detected: DetectedFood[] = [];
  let rawResponse = "";
  try {
    const result = await ai.run(VISION_MODEL, {
      image: imageBytes,
      prompt: buildPrompt(locale),
      max_tokens: 512,
    });
    rawResponse = (result as { description?: string; response?: string }).description ??
      (result as { response?: string }).response ??
      JSON.stringify(result);
    detected = tryParseFoods(rawResponse) ?? [];
  } catch (err) {
    rawResponse = `ERROR: ${String(err)}`;
  }

  await setMealPhotoAiResponse(db, photo.id, rawResponse);

  if (detected.length === 0) {
    // Uncertainty handling: ask rather than invent (spec's core Meal Vision rule).
    return NextResponse.json({
      photoId: photo.id,
      foods: [],
      clarificationNeeded: true,
      clarificationQuestion:
        locale === "he"
          ? "לא הצלחתי לזהות בבירור מה יש בתמונה. אפשר לתאר את המנה במילים?"
          : "I couldn't clearly identify what's in the photo. Can you describe the meal in words?",
    });
  }

  return NextResponse.json({
    photoId: photo.id,
    foods: detected,
    clarificationNeeded: false,
  });
}
