import { CalendarMonth } from "@/components/CalendarMonth";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <CalendarMonth />
      <div className="mt-16 border-t border-zinc-200 pt-12 dark:border-zinc-800">
        <Dashboard />
      </div>
    </div>
  );
}
