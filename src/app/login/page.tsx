"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Login failed");
        return;
      }
      const from = search.get("from");
      const dest = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
      router.replace(dest);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Your calendar hub</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Only you can change calendars, sync, locations, and planner links. Sign in with the app password from{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">APP_PASSWORD</code> in{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">.env</code>. Connecting Google, Microsoft, or
        Zoho still uses their OAuth screens.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          App password
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-xs text-zinc-500">
        Local dev: if <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">APP_PASSWORD</code> is unset, the app
        stays open without a real gate; you can still submit this form with any password to set a session cookie.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-zinc-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
