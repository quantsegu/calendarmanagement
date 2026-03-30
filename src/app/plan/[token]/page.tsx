"use client";

import { useParams } from "next/navigation";
import { CalendarMonth } from "@/components/CalendarMonth";

export default function PlanPage() {
  const params = useParams();
  const token = params.token as string;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-4">
      <header className="mb-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm font-medium text-violet-600 dark:text-violet-400">Shared planner</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Availability & location</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Month calendar: busy vs free, where they are, and meeting titles (as shared). Use the arrows or{" "}
          <strong>Today</strong> to move around; <strong>Refresh</strong> pulls the latest data for the visible month.
        </p>
      </header>
      <CalendarMonth planToken={token} className="mt-0" />
    </div>
  );
}
