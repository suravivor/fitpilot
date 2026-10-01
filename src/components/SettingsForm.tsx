"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";
import type { Locale } from "@/i18n";

interface SettingsState {
  notificationsEnabled: boolean;
  proactiveCoachingEnabled: boolean;
  workoutReminders: boolean;
  nutritionReminders: boolean;
  checkinReminders: boolean;
}

export default function SettingsForm({
  t,
  initialLocale,
  initialTrackingDepth,
  initialSettings,
}: {
  t: Dictionary;
  initialLocale: Locale;
  initialTrackingDepth: string;
  initialSettings: SettingsState;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [trackingDepth, setTrackingDepth] = useState(initialTrackingDepth);
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof SettingsState) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        trackingDepth,
        notificationsEnabled: settings.notificationsEnabled,
        proactiveCoachingEnabled: settings.proactiveCoachingEnabled,
        workoutReminders: settings.workoutReminders,
        nutritionReminders: settings.nutritionReminders,
        checkinReminders: settings.checkinReminders,
      }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
    if (locale !== initialLocale) {
      // Reload so <html lang/dir> and every server-rendered string flip immediately.
      window.location.reload();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-medium mb-3">{t.language}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setLocale("he")}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              locale === "he" ? "border-accent bg-accent/10" : ""
            }`}
          >
            {t.hebrew}
          </button>
          <button
            onClick={() => setLocale("en")}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              locale === "en" ? "border-accent bg-accent/10" : ""
            }`}
          >
            {t.english}
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium mb-3">{t.trackingDepthQuestion}</h2>
        <div className="space-y-2">
          {(["minimal", "balanced", "detailed"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setTrackingDepth(d)}
              className={`w-full text-start rounded-lg border px-3 py-2 text-sm ${
                trackingDepth === d ? "border-accent bg-accent/10 font-medium" : ""
              }`}
            >
              {d === "minimal" ? t.trackingMinimal : d === "balanced" ? t.trackingBalanced : t.trackingDetailed}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium mb-3">{t.notifications}</h2>
        <div className="space-y-2">
          <ToggleRow label={t.notifications} checked={settings.notificationsEnabled} onChange={() => toggle("notificationsEnabled")} />
          <ToggleRow
            label={t.proactiveCoaching}
            checked={settings.proactiveCoachingEnabled}
            onChange={() => toggle("proactiveCoachingEnabled")}
          />
          <ToggleRow label={t.logWorkout} checked={settings.workoutReminders} onChange={() => toggle("workoutReminders")} />
          <ToggleRow
            label={t.logMeal}
            checked={settings.nutritionReminders}
            onChange={() => toggle("nutritionReminders")}
          />
          <ToggleRow
            label={t.weeklyCheckIn}
            checked={settings.checkinReminders}
            onChange={() => toggle("checkinReminders")}
          />
        </div>
      </Card>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-accent hover:bg-accent-strong text-white rounded-card py-3 font-medium disabled:opacity-60"
      >
        {saving ? t.loading : t.saveSettings}
      </button>
      {saved && <p className="text-good text-sm text-center">{t.settingsSaved}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="w-full flex items-center justify-between py-1.5 text-sm">
      <span>{label}</span>
      <span
        className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${
          checked ? "bg-accent justify-end" : "bg-border justify-start"
        }`}
      >
        <span className="w-5 h-5 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}
