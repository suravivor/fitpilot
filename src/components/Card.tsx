export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border rounded-card p-4 shadow-sm ${className}`}>{children}</div>
  );
}

export function StatBar({
  label,
  consumed,
  target,
  unit,
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const over = consumed > target;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span
          dir="ltr"
          style={{ unicodeBidi: "isolate" }}
          className={over ? "text-bad font-medium" : "text-text"}
        >
          {Math.round(consumed)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-bg overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-bad" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
