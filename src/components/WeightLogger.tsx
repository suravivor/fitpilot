"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

export default function WeightLogger({ t }: { t: Dictionary }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!value) return;
    setSaving(true);
    await fetch("/api/weight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ valueKg: Number(value) }),
    });
    setValue("");
    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-muted mb-2">{t.logWeight}</h2>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          placeholder={t.weightValue}
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
      {saved && <p className="text-good text-sm mt-2">{t.weightSaved}</p>}
    </Card>
  );
}
