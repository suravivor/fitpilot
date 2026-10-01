"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

interface NutritionBasis {
  caloriesPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
}

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
  // The per-gram (or per-unit) rate the AI's own estimate implies —
  // preserved so that editing quantity can derive the other four numbers
  // instead of leaving them stale or forcing the user to retype them.
  // Null when the basis can't be computed (e.g. the AI reported 0
  // quantity) — in that case quantity edits fall back to not touching
  // the macros, same as before this change.
  basis: NutritionBasis | null;
}

function basisFrom(f: { quantity: number; calories: number; protein: number; carbs: number; fat: number }): NutritionBasis | null {
  if (!f.quantity || f.quantity <= 0) return null;
  return {
    caloriesPerUnit: f.calories / f.quantity,
    proteinPerUnit: f.protein / f.quantity,
    carbsPerUnit: f.carbs / f.quantity,
    fatPerUnit: f.fat / f.quantity,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export default function MealPhotoLogger({ t }: { t: Dictionary }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [foods, setFoods] = useState<DetectedFood[]>([]);
  const [clarification, setClarification] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Distinct from "clarificationNeeded" (the AI honestly couldn't tell what's
  // in the photo — spec's "ask, don't invent" path). This is the *other*
  // failure mode: the request itself didn't complete (network error, the
  // server returned a non-OK status, or a response we can't parse). Silently
  // reverting to the idle "take a photo" button here — which is what used to
  // happen — leaves the user thinking nothing happened at all, with no way
  // to tell a real failure apart from "I never tapped the button."
  const [requestError, setRequestError] = useState<string | null>(null);
  const lastFileRef = useRef<File | null>(null);

  async function analyzePhoto(file: File) {
    lastFileRef.current = file;
    setAnalyzing(true);
    setClarification(null);
    setRequestError(null);
    setFoods([]);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/meal-photo", { method: "POST", body: formData });

      if (!res.ok) {
        setAnalyzing(false);
        setRequestError(t.photoAnalysisFailed);
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        photoId?: string;
        foods?: Omit<DetectedFood, "basis">[];
        clarificationNeeded?: boolean;
        clarificationQuestion?: string;
      } | null;

      setAnalyzing(false);

      if (!data) {
        setRequestError(t.photoAnalysisFailed);
        return;
      }

      setPhotoId(data.photoId ?? null);
      if (data.clarificationNeeded) {
        setClarification(data.clarificationQuestion ?? t.noFoodsDetected);
      } else {
        const detected = (data.foods ?? []).map((f) => ({ ...f, basis: basisFrom(f) }));
        setFoods(detected);
      }
    } catch {
      // Network-level failure (offline, request aborted, etc.) — same
      // honest-failure message, not a silent revert.
      setAnalyzing(false);
      setRequestError(t.photoAnalysisFailed);
    }
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await analyzePhoto(file);
  }

  function retry() {
    if (lastFileRef.current) {
      analyzePhoto(lastFileRef.current);
    } else {
      inputRef.current?.click();
    }
  }

  function updateFood(idx: number, field: keyof DetectedFood | "quantity", value: string) {
    setFoods((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;

        if (field === "name" || field === "unit" || field === "confidence" || field === "preparation") {
          return { ...f, [field]: value } as DetectedFood;
        }

        if (field === "quantity") {
          const newQuantity = Number(value) || 0;
          if (!f.basis) {
            // No basis to derive from (e.g. AI reported 0g) — just record
            // the quantity, macros are unaffected until the user sets them.
            return { ...f, quantity: newQuantity };
          }
          // The mandatory part: changing grams recalculates every macro
          // from the preserved per-gram basis — the user never has to
          // manually redo this arithmetic.
          return {
            ...f,
            quantity: newQuantity,
            calories: round1(f.basis.caloriesPerUnit * newQuantity),
            protein: round1(f.basis.proteinPerUnit * newQuantity),
            carbs: round1(f.basis.carbsPerUnit * newQuantity),
            fat: round1(f.basis.fatPerUnit * newQuantity),
          };
        }

        // Direct manual override of calories/protein/carbs/fat: honor it
        // exactly as typed, AND re-derive the basis from it so that a
        // *subsequent* quantity edit scales from the user's corrected
        // value rather than silently reverting to the original AI rate.
        const newValue = Number(value) || 0;
        const updated = { ...f, [field]: newValue } as DetectedFood;
        updated.basis = basisFrom(updated);
        return updated;
      })
    );
  }

  async function confirmAndLog() {
    if (!photoId || foods.length === 0) return;
    setSaving(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/meal-photo/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          photoId,
          items: foods.map((f) => ({
            foodName: f.name,
            quantity: f.quantity,
            unit: f.unit,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
            isEstimated: f.confidence !== "HIGH",
            preparation: f.preparation,
          })),
        }),
      });
      setSaving(false);
      if (!res.ok) {
        // Previously this fell through to clearing the form and refreshing
        // regardless of the response — so a failed save still looked like a
        // success (foods disappeared, no error) even though nothing was
        // written. Now a failure keeps the confirmation screen up with an
        // explicit error, so the user can retry rather than lose the data
        // silently.
        setRequestError(t.photoSaveFailed);
        return;
      }
      setFoods([]);
      setPhotoId(null);
      router.refresh();
    } catch {
      setSaving(false);
      setRequestError(t.photoSaveFailed);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-medium mb-2">{t.photoMeal}</h2>

      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFileSelected} className="hidden" />

      {!analyzing && foods.length === 0 && !clarification && !requestError && (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border rounded-lg py-2.5 text-sm font-medium"
        >
          📷 {t.takePhoto}
        </button>
      )}

      {analyzing && <p className="text-sm text-muted">{t.analyzingPhoto}</p>}

      {requestError && (
        <div>
          <p className="text-sm mb-2 text-bad">❌ {requestError}</p>
          <div className="flex gap-2">
            <button onClick={retry} className="flex-1 border rounded-lg py-2 text-sm font-medium">
              {t.retry}
            </button>
            <button
              onClick={() => setRequestError(null)}
              className="flex-1 text-sm text-accent font-medium"
            >
              {t.enterManually}
            </button>
          </div>
        </div>
      )}

      {clarification && (
        <div>
          <p className="text-sm mb-2">
            <span className="font-medium">{t.clarificationNeeded}: </span>
            {clarification}
          </p>
          <button
            onClick={() => {
              setClarification(null);
              inputRef.current?.click();
            }}
            className="text-sm text-accent font-medium"
          >
            {t.takePhoto}
          </button>
        </div>
      )}

      {foods.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{t.confirmFoods}</p>
          {foods.map((f, idx) => (
            <div key={idx} className="border rounded-lg p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  value={f.name}
                  onChange={(e) => updateFood(idx, "name", e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm bg-bg"
                />
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    f.confidence === "HIGH"
                      ? "bg-good/10 text-good"
                      : f.confidence === "MEDIUM"
                      ? "bg-warn/10 text-warn"
                      : "bg-bad/10 text-bad"
                  }`}
                >
                  {f.confidence}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted">{t.preparation}:</span>
                <select
                  value={f.preparation}
                  onChange={(e) => updateFood(idx, "preparation", e.target.value)}
                  className="rounded border px-1.5 py-1 bg-bg"
                >
                  <option value="unspecified">{t.prepUnspecified}</option>
                  <option value="raw">{t.prepRaw}</option>
                  <option value="cooked">{t.prepCooked}</option>
                </select>
              </div>
              <div className="grid grid-cols-5 gap-1 text-xs">
                <input
                  type="number"
                  value={f.quantity}
                  onChange={(e) => updateFood(idx, "quantity", e.target.value)}
                  placeholder={t.quantity}
                  className="rounded border px-1.5 py-1 bg-bg"
                />
                <input
                  type="number"
                  value={f.calories}
                  onChange={(e) => updateFood(idx, "calories", e.target.value)}
                  placeholder="kcal"
                  className="rounded border px-1.5 py-1 bg-bg"
                />
                <input
                  type="number"
                  value={f.protein}
                  onChange={(e) => updateFood(idx, "protein", e.target.value)}
                  placeholder="P"
                  className="rounded border px-1.5 py-1 bg-bg"
                />
                <input
                  type="number"
                  value={f.carbs}
                  onChange={(e) => updateFood(idx, "carbs", e.target.value)}
                  placeholder="C"
                  className="rounded border px-1.5 py-1 bg-bg"
                />
                <input
                  type="number"
                  value={f.fat}
                  onChange={(e) => updateFood(idx, "fat", e.target.value)}
                  placeholder="F"
                  className="rounded border px-1.5 py-1 bg-bg"
                />
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFoods([]);
                setPhotoId(null);
              }}
              className="flex-1 border rounded-lg py-2 text-sm font-medium"
            >
              {t.cancel}
            </button>
            <button
              onClick={confirmAndLog}
              disabled={saving}
              className="flex-1 bg-accent text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? t.loading : t.addToToday}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
