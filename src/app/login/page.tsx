"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import he from "@/i18n/he";

const t = he;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError(t.authError);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-accent">{t.appName}</h1>
          <p className="text-muted text-sm mt-1">{t.tagline}</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface border rounded-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t.login}</h2>
          <div>
            <label className="block text-sm text-muted mb-1">{t.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 bg-bg"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">{t.password}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 bg-bg"
            />
          </div>
          {error && <p className="text-bad text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-strong text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {loading ? t.loading : t.loginCta}
          </button>
          <p className="text-sm text-center text-muted">
            {t.noAccount}{" "}
            <Link href="/signup" className="text-accent font-medium">
              {t.signup}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
