"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import he from "@/i18n/he";

const t = he;

type GoalType = "weight_loss" | "muscle_gain" | "recomposition" | "maintenance";
type TrackingDepth = "minimal" | "balanced" | "detailed";

const GOAL_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "weight_loss", label: t.goalWeightLoss },
  { value: "muscle_gain", label: t.goalMuscleGain },
  { value: "recomposition", label: t.goalRecomposition },
  { value: "maintenance", label: t.goalMaintenance },
];

const DEPTH_OPTIONS: { value: TrackingDepth; label: string; desc: string }[] = [
  { value: "minimal", label: t.trackingMinimal, desc: t.trackingMinimalDesc },
  { value: "balanced", label: t.trackingBalanced, desc: t.trackingBalancedDesc },
  { value: "detailed", label: t.trackingDetailed, desc: t.trackingDetailedDesc },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [age, setAge] = useState("");
  const [trackingDepth, setTrackingDepth] = useState<TrackingDepth>("balanced");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalSteps = 3;

  async function finish() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goalType,
        currentWeightKg: Number(currentWeightKg),
        targetWeightKg: targetWeightKg ? Number(targetWeightKg) : undefined,
        heightCm: Number(heightCm),
        age: Number(age),
        trackingDepth,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? t.error);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">{t.onboardingWelcome}</h1>
            <p className="text-muted text-sm mt-1">{t.onboardingWelcomeSub}</p>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-border"}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-surface border rounded-card p-6 space-y-5">
          {step === 1 && (
            <>
              <h2 className="font-semibold">{t.goalQuestion}</h2>
              <div className="space-y-2">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGoalType(opt.value)}
                    className={`w-full text-start rounded-lg border px-4 py-3 transition-colors ${
                      goalType === opt.value ? "border-accent bg-accent/10 font-medium" : "border-border"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!goalType}
                onClick={() => setStep(2)}
                className="w-full bg-accent hover:bg-accent-strong text-white rounded-lg py-2.5 font-medium disabled:opacity-40"
              >
                {t.continueBtn}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-semibold">{t.onboardingWelcome}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">{t.currentWeight}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={currentWeightKg}
                    onChange={(e) => setCurrentWeightKg(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 bg-bg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t.targetWeight}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={targetWeightKg}
                    onChange={(e) => setTargetWeightKg(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 bg-bg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t.height}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 bg-bg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">{t.age}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    value={age}
                    onChange={(e) => {
                      // Age must be a whole number — the server rejects a
                      // decimal (e.g. "42.5") with a raw validation error.
                      // Stripping non-digits here means that error can never
                      // happen, instead of surfacing an ugly message after
                      // the fact.
                      const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                      setAge(digitsOnly);
                    }}
                    className="w-full rounded-lg border px-3 py-2 bg-bg"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border rounded-lg py-2.5 font-medium"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={!currentWeightKg || !heightCm || !age}
                  onClick={() => setStep(3)}
                  className="flex-1 bg-accent hover:bg-accent-strong text-white rounded-lg py-2.5 font-medium disabled:opacity-40"
                >
                  {t.continueBtn}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-semibold">{t.trackingDepthQuestion}</h2>
              <div className="space-y-2">
                {DEPTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTrackingDepth(opt.value)}
                    className={`w-full text-start rounded-lg border px-4 py-3 transition-colors ${
                      trackingDepth === opt.value ? "border-accent bg-accent/10" : "border-border"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-sm text-muted">{opt.desc}</div>
                  </button>
                ))}
              </div>
              {error && <p className="text-bad text-sm">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 border rounded-lg py-2.5 font-medium"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={finish}
                  className="flex-1 bg-accent hover:bg-accent-strong text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
                >
                  {loading ? t.loading : t.finishOnboarding}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
