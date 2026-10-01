"use client";

import { useState } from "react";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

export default function WeeklyCheckIn({ t }: { t: Dictionary }) {
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [stress, setStress] = useState(3);
  const [hunger, setHunger] = useState(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setSaving(true);
    await fetch("/api/checkins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        energyLevel: energy,
        sleepQuality: sleep,
        stressLevel: stress,
        hungerLevel: hunger,
        freeTextFeedback: note || null,
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted">{label}</span>
          <span className="font-medium">{value}/5</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
      </div>
    );
  }

  if (saved) {
    return (
      <Card>
        <p className="text-good text-sm">{t.checkInSaved}</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-sm font-medium mb-3">{t.weeklyCheckIn}</h2>
      <div className="space-y-3">
        <Slider label={t.energyLevel} value={energy} onChange={setEnergy} />
        <Slider label={t.sleepQuality} value={sleep} onChange={setSleep} />
        <Slider label={t.stressLevel} value={stress} onChange={setStress} />
        <Slider label={t.hungerLevel} value={hunger} onChange={setHunger} />
        <textarea
          placeholder={t.freeTextFeedback}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border px-3 py-2 bg-bg text-sm"
        />
        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-accent text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
        >
          {saving ? t.loading : t.submitCheckIn}
        </button>
      </div>
    </Card>
  );
}
