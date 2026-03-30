"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
    router.refresh();
  }

  if (path === "/login") {
    return <>{children}</>;
  }

  if (path === "/docs") {
    return (
      <>
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">API documentation</span>
          <div className="flex items-center gap-4">
            <Link href="/api/openapi" className="text-sm text-violet-600 hover:underline dark:text-violet-400">
              OpenAPI JSON
            </Link>
            <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Calendar app
            </Link>
          </div>
        </header>
        {children}
      </>
    );
  }

  if (path.startsWith("/plan/")) {
    return (
      <>
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Shared planner (read-only)</span>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              API
            </Link>
            <Link href="/login" className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
              Manage calendar
            </Link>
          </div>
        </header>
        {children}
      </>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            My calendar
          </Link>
          <Link href="/docs" className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
            API docs
          </Link>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Sign out
        </button>
      </header>
      {children}
    </>
  );
}
