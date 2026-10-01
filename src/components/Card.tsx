export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-card p-4 ${className}`}>{children}</div>
  );
}

const METRIC_COLOR: Record<string, string> = {
  calories: "var(--color-calories)",
  protein: "var(--color-protein)",
  carbs: "var(--color-carbs)",
  fat: "var(--color-fat)",
};

export function StatBar({
  label,
  consumed,
  target,
  unit,
  metric,
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  /** Which macro this bar represents — picks a dedicated color so the same
   * metric reads as the same color everywhere in the app (badges, bars,
   * numbers), rather than every bar sharing one recycled accent color. */
  metric: "calories" | "protein" | "carbs" | "fat";
}) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const over = consumed > target;
  const color = METRIC_COLOR[metric];
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1.5">
        <span className="text-muted">{label}</span>
        <span
          dir="ltr"
          style={{ unicodeBidi: "isolate", color: over ? "var(--color-bad)" : "var(--color-text)" }}
          className="font-medium"
        >
          {Math.round(consumed)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 rounded-pill bg-bg overflow-hidden">
        <div
          className="h-full rounded-pill transition-all"
          style={{ width: `${pct}%`, background: over ? "var(--color-bad)" : color }}
        />
      </div>
    </div>
  );
}

/**
 * The dashboard's one bold hero element (frontend-design principle: spend
 * boldness in one place). Everything else on the page stays quiet and flat;
 * this ring is the single thing a returning user's eye should land on, and
 * it answers the single most important question — "how much is left today?"
 * — in one glance, before any label is read.
 */
export function CalorieRing({
  consumed,
  target,
  label,
  remainingLabel,
  unit,
}: {
  consumed: number;
  target: number;
  label: string;
  remainingLabel: string;
  unit: string;
}) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  const remaining = Math.round(target - consumed);
  const size = 184;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const over = consumed > target;

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-border)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? "var(--color-bad)" : "var(--color-calories)"}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="text-3xl font-extrabold leading-none">
            {Math.abs(remaining)}
          </span>
          <span className="text-xs text-muted">{remainingLabel}</span>
        </div>
      </div>
      <div className="mt-3 text-sm text-muted">
        {label}:{" "}
        <span dir="ltr" style={{ unicodeBidi: "isolate" }} className="font-medium text-text">
          {Math.round(consumed)} / {Math.round(target)} {unit}
        </span>
      </div>
    </div>
  );
}
