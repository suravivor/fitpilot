import Link from "next/link";
import type { Dictionary } from "@/i18n/he";

export default function Nav({ t, active }: { t: Dictionary; active: string }) {
  const items = [
    { href: "/", key: "home", label: t.navHome, icon: "🏠" },
    { href: "/nutrition", key: "nutrition", label: t.navNutrition, icon: "🍽️" },
    { href: "/workout", key: "workout", label: t.navWorkoutFull, icon: "🏋️" },
    { href: "/progress", key: "progress", label: t.navProgress, icon: "📈" },
    { href: "/settings", key: "settings", label: t.navSettings, icon: "⚙️" },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 z-20">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
              active === item.key ? "text-accent font-medium" : "text-muted"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
