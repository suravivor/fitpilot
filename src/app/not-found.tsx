import Link from "next/link";

export const runtime = "edge";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted">הדף לא נמצא</p>
      <Link href="/" className="text-accent font-medium">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
