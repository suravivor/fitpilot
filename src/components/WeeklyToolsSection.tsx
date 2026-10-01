"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/he";

/**
 * Weekly check-in and the weekly review are "balanced"/"detailed" defaults;
 * in minimal mode they're collapsed behind a toggle rather than removed —
 * the spec is explicit that tracking depth should change what's surfaced
 * by default, never take away access to real functionality.
 */
export default function WeeklyToolsSection({
  t,
  trackingDepth,
  children,
}: {
  t: Dictionary;
  trackingDepth: "minimal" | "balanced" | "detailed";
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(trackingDepth !== "minimal");

  if (trackingDepth !== "minimal") return <>{children}</>;

  return (
    <div>
      <button onClick={() => setShow((s) => !s)} className="text-xs text-accent font-medium mb-2">
        {show ? t.hideWeeklyTools : t.showWeeklyTools}
      </button>
      {show && <div className="space-y-4">{children}</div>}
    </div>
  );
}
