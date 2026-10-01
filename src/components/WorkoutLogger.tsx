"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./Card";
import type { Dictionary } from "@/i18n/he";

interface Exercise {
  id: string;
  name: string;
  muscle_groups: string | null;
}

interface DraftSet {
  exerciseName: string;
  exerciseId: string | null;
  setNumber: number;
  reps: number;
  weightKg: number;
  rir: number | null;
}

export default function WorkoutLogger({ t }: { t: Dictionary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<DraftSet[]>([]);
  const [saving, setSaving] = useState(false);

  const [exerciseName, setExerciseName] = useState("");
  const [reps, setReps] = useState("8");
  const [weightKg, setWeightKg] = useState("");
  const [rir, setRir] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/exercises")
      .then((r) => r.json() as Promise<{ exercises: Exercise[] }>)
      .then((data) => setExercises(data.exercises ?? []))
      .catch(() => {});
  }, [open]);

  function addSet() {
    if (!exerciseName || !weightKg) return;
    const countForExercise = sets.filter((s) => s.exerciseName === exerciseName).length;
    const exercise = exercises.find((e) => e.name === exerciseName);
    setSets((prev) => [
      ...prev,
      {
        exerciseName,
        exerciseId: exercise?.id ?? null,
        setNumber: countForExercise + 1,
        reps: Number(reps) || 0,
        weightKg: Number(weightKg) || 0,
        rir: rir ? Number(rir) : null,
      },
    ]);
    setWeightKg("");
  }

  async function saveWorkout() {
    if (sets.length === 0) return;
    setSaving(true);
    await fetch("/api/workouts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sets }),
    });
    setSets([]);
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
        {t.logWorkout}
      </button>
    );
  }

  return (
    <Card>
      {sets.length > 0 && (
        <ul className="mb-4 space-y-1">
          {sets.map((s, idx) => (
            <li key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
              <span>
                {s.exerciseName} — {t.set} {s.setNumber}
              </span>
              <span className="text-muted">
                {s.reps} × {s.weightKg}kg{s.rir != null ? ` (RIR ${s.rir})` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <input
          list="exercise-options"
          placeholder={t.exercise}
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 bg-bg text-sm"
        />
        <datalist id="exercise-options">
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.name} />
          ))}
        </datalist>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            placeholder={t.reps}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm"
          />
          <input
            type="number"
            placeholder={t.weight}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm"
          />
          <input
            type="number"
            placeholder={t.rir}
            value={rir}
            onChange={(e) => setRir(e.target.value)}
            className="rounded-lg border px-3 py-2 bg-bg text-sm"
          />
        </div>
        <button
          onClick={addSet}
          disabled={!exerciseName || !weightKg}
          className="w-full border rounded-lg py-2 text-sm font-medium disabled:opacity-40"
        >
          {t.addSet}
        </button>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setOpen(false)} className="flex-1 border rounded-lg py-2.5 font-medium">
          {t.cancel}
        </button>
        <button
          onClick={saveWorkout}
          disabled={sets.length === 0 || saving}
          className="flex-1 bg-accent text-white rounded-lg py-2.5 font-medium disabled:opacity-40"
        >
          {saving ? t.loading : t.saveWorkout}
        </button>
      </div>
    </Card>
  );
}
