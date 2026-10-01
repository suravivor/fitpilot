"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

interface DraftItem {
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function MealLogger({ t }: { t: Dictionary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>("snack");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Current item form
  const [foodName, setFoodName] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  function addItem() {
    if (!foodName || !calories) return;
    setItems((prev) => [
      ...prev,
      {
        foodName,
        quantity: Number(quantity) || 0,
        unit: "g",
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
      },
    ]);
    setFoodName("");
    setQuantity("100");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  }

  async function saveMeal() {
    if (items.length === 0) return;
    setSaving(true);
    await fetch("/api/meals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mealSlot: slot,
        items: items.map((i) => ({ ...i, isEstimated: true })),
      }),
    });
    setItems([]);
    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-accent hover:bg-accent-strong text-white rounded-card py-3.5 font-medium"
      >
        {t.logMeal}
      </button>
    );
  }

  return (
    <Card>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {SLOTS.map((s) => (
          <button
            key={s}
            onClick={() => setSlot(s)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              slot === s ? "bg-accent text-white" : "bg-bg text-muted"
            }`}
          >
            {t[s]}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <ul className="mb-4 space-y-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
              <span>
                {it.foodName} — {it.quantity}g
              </span>
              <span className="text-muted">{it.calories} kcal</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <input
          placeholder={t.foodName}
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 bg-bg text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder={`${t.quantity} (g)`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm"
          />
          <input
            type="number"
            placeholder={t.calories}
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm"
          />
          <input
            type="number"
            placeholder={`${t.protein} (g)`}
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm"
          />
          <input
            type="number"
            placeholder={`${t.carbs} (g)`}
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm"
          />
          <input
            type="number"
            placeholder={`${t.fat} (g)`}
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm col-span-2"
          />
        </div>
        <button
          onClick={addItem}
          disabled={!foodName || !calories}
          className="w-full border rounded-lg py-2 text-sm font-medium disabled:opacity-40"
        >
          {t.addToMeal}
        </button>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setOpen(false)} className="flex-1 border rounded-lg py-2.5 font-medium">
          {t.cancel}
        </button>
        <button
          onClick={saveMeal}
          disabled={items.length === 0 || saving}
          className="flex-1 bg-accent text-white rounded-lg py-2.5 font-medium disabled:opacity-40"
        >
          {saving ? t.loading : t.saveMeal}
        </button>
      </div>
    </Card>
  );
}
