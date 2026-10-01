"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

const TYPES = ["waist", "chest", "arm", "thigh", "hip"] as const;

export default function MeasurementLogger({ t }: { t: Dictionary }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>("waist");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!value) return;
    setSaving(true);
    await fetch("/api/measurements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, valueCm: Number(value) }),
    });
    setValue("");
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-muted mb-2">{t.addMeasurement}</h2>
      <div className="flex gap-2 mb-2 overflow-x-auto">
        {TYPES.map((tp) => (
          <button
            key={tp}
            onClick={() => setType(tp)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              type === tp ? "bg-accent text-white" : "bg-bg text-muted"
            }`}
          >
            {t[tp]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder="ס״מ"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 bg-bg"
        />
        <button
          onClick={save}
          disabled={!value || saving}
          className="bg-accent hover:bg-accent-strong text-white rounded-lg px-5 font-medium disabled:opacity-40"
        >
          {saving ? t.loading : t.save}
        </button>
      </div>
      {saved && <p className="text-good text-sm mt-2">{t.measurementSaved}</p>}
    </Card>
  );
}
