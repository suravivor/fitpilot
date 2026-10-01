"use client";

import { signOut } from "next-auth/react";
import type { Dictionary } from "@/i18n/he";

export default function LogoutButton({ t }: { t: Dictionary }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-muted underline underline-offset-2"
    >
      {t.logout}
    </button>
  );
}
