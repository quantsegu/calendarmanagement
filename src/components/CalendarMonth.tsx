"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CalEvent = {
  id: string;
  kind?: "synced" | "manual";
  title: string;
  startUtc: string;
  endUtc: string;
  location: string | null;
  sourceName: string;
  color: string;
};

type ScheduleSlot = {
  startUtc: string;
  endUtc: string;
  busy: boolean;
  eventTitle: string | null;
  eventLocation: string | null;
  sourceName: string | null;
  sourceColor: string | null;
  placeLabel: string | null;
  placeDetail: string | null;
};

type ScheduleResponse = {
  slots: ScheduleSlot[];
  events: CalEvent[];
  locationWindows: {
    id: string;
    label: string;
    address: string | null;
    startUtc: string;
    endUtc: string;
  }[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfLocalDay(y: number, m: number, d: number) {
  return new Date(y, m, d, 0, 0, 0, 0);
}

function endOfLocalDay(y: number, m: number, d: number) {
  return new Date(y, m, d, 23, 59, 59, 999);
}

function overlapsLocalDay(ev: CalEvent, y: number, m: number, day: number) {
  const ds = startOfLocalDay(y, m, day);
  const de = endOfLocalDay(y, m, day);
  const es = new Date(ev.startUtc);
  const ee = new Date(ev.endUtc);
  return es <= de && ee >= ds;
}

function overlapsLocalDayLoc(
  w: ScheduleResponse["locationWindows"][0],
  y: number,
  m: number,
  day: number,
) {
  const ds = startOfLocalDay(y, m, day);
  const de = endOfLocalDay(y, m, day);
  const ws = new Date(w.startUtc);
  const we = new Date(w.endUtc);
  return ws <= de && we >= ds;
}

function slotOverlapsLocalDay(slot: { startUtc: string; endUtc: string }, y: number, m: number, day: number) {
  const ds = startOfLocalDay(y, m, day).getTime();
  const de = endOfLocalDay(y, m, day).getTime();
  const s = new Date(slot.startUtc).getTime();
  const e = new Date(slot.endUtc).getTime();
  return s < de && e > ds;
}

/** Single line from merged slot (event + location windows). */
function placeLineFromSlot(s: ScheduleSlot): string | null {
  const a = s.placeLabel?.trim() || "";
  const b = s.placeDetail?.trim() || "";
  if (!a && !b) return null;
  if (a && b && a !== b) return `${a} — ${b}`;
  return a || b;
}

function uniquePlaceLinesForDay(slots: ScheduleSlot[], y: number, m: number, day: number): string[] {
  const daySlots = slots
    .filter((s) => slotOverlapsLocalDay(s, y, m, day))
    .sort((a, b) => +new Date(a.startUtc) - +new Date(b.startUtc));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of daySlots) {
    const line = placeLineFromSlot(s);
    if (line && !seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}

function slotsForLocalDay(slots: ScheduleSlot[], y: number, m: number, day: number): ScheduleSlot[] {
  return slots
    .filter((s) => slotOverlapsLocalDay(s, y, m, day))
    .sort((a, b) => +new Date(a.startUtc) - +new Date(b.startUtc));
}

function formatSlotInterval(s: ScheduleSlot) {
  const a = new Date(s.startUtc);
  const b = new Date(s.endUtc);
  const tOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${a.toLocaleTimeString(undefined, tOpts)}–${b.toLocaleTimeString(undefined, tOpts)}`;
}

function formatTimeRange(ev: CalEvent) {
  const s = new Date(ev.startUtc);
  const e = new Date(ev.endUtc);
  const sameDay =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  if (!sameDay) {
    return `${s.toLocaleString(undefined, { ...opts, month: "short", day: "numeric" })} → ${e.toLocaleString(undefined, { ...opts, month: "short", day: "numeric" })}`;
  }
  const sd = s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${sd} · ${s.toLocaleTimeString(undefined, opts)}–${e.toLocaleTimeString(undefined, opts)}`;
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  const startPad = first.getDay();
  const weeks: (number | null)[][] = [];
  let current: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) current.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    current.push(d);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }
  return weeks;
}

export type CalendarMonthProps = {
  /** Use shared planner API (no login). Omit for owner dashboard. */
  planToken?: string;
  className?: string;
};

export function CalendarMonth({ planToken, className = "mt-6" }: CalendarMonthProps) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pickDay, setPickDay] = useState<number | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
    try {
      const path = planToken
        ? `/api/plan/${encodeURIComponent(planToken)}/schedule`
        : "/api/schedule";
      const u = new URL(path, window.location.origin);
      u.searchParams.set("from", from.toISOString());
      u.searchParams.set("to", to.toISOString());
      const res = await fetch(u.toString(), planToken ? {} : { credentials: "include" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
          hint?: string;
        };
        if (res.status === 401 && !planToken) {
          setErr("Session expired — sign in again (Sign out, then open /login).");
        } else if (res.status === 404 && planToken) {
          setErr(j.error ?? "Invalid or expired planner link.");
        } else {
          const parts = [j.error, j.detail, j.hint].filter(Boolean);
          setErr(parts.length > 0 ? parts.join(" — ") : `Could not load calendar (HTTP ${res.status})`);
        }
        setData(null);
        return;
      }
      setData(await res.json());
    } catch {
      setErr("Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, planToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (planToken) return;
    const fn = () => load();
    window.addEventListener("calendar-refresh", fn);
    return () => window.removeEventListener("calendar-refresh", fn);
  }, [load, planToken]);

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    if (!data?.events) return map;
    for (let d = 1; d <= 31; d++) {
      const list = data.events.filter((ev) => overlapsLocalDay(ev, year, month, d));
      if (list.length) map.set(d, list.sort((a, b) => +new Date(a.startUtc) - +new Date(b.startUtc)));
    }
    return map;
  }, [data, year, month]);

  const locByDay = useMemo(() => {
    const map = new Map<number, ScheduleResponse["locationWindows"]>();
    if (!data?.locationWindows) return map;
    for (let d = 1; d <= 31; d++) {
      const list = data.locationWindows.filter((w) => overlapsLocalDayLoc(w, year, month, d));
      if (list.length) map.set(d, list);
    }
    return map;
  }, [data, year, month]);

  const placesByDay = useMemo(() => {
    const map = new Map<number, string[]>();
    const slots = data?.slots ?? [];
    for (let d = 1; d <= 31; d++) {
      const lines = uniquePlaceLinesForDay(slots, year, month, d);
      if (lines.length) map.set(d, lines);
    }
    return map;
  }, [data, year, month]);

  const selectedEvents = pickDay != null ? eventsByDay.get(pickDay) ?? [] : [];
  const selectedLocs = pickDay != null ? locByDay.get(pickDay) ?? [] : [];
  const selectedSlots = pickDay != null ? slotsForLocalDay(data?.slots ?? [], year, month, pickDay) : [];

  const title = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <section className={className}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {planToken ? (
              <>
                Shared view · busy/free and <span className="text-emerald-700 dark:text-emerald-400">Where</span> from
                their calendars and location blocks. Tap a day for the timeline.
              </>
            ) : (
              <>
                Events from your calendars · each day shows{" "}
                <span className="text-emerald-700 dark:text-emerald-400">Where</span> from location blocks and meeting
                places (merged). Click a day for the full timeline.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {err && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{err}</p>}
      {loading && !data && <p className="mt-4 text-sm text-zinc-500">Loading calendar…</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="grid min-w-[720px] grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((row, wi) => (
          <div key={wi} className="grid min-w-[720px] grid-cols-7 border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/80">
            {row.map((day, di) => {
              if (day == null) {
                return <div key={`e-${wi}-${di}`} className="min-h-[132px] bg-zinc-50/50 dark:bg-zinc-950/30" />;
              }
              const isToday =
                day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const evs = eventsByDay.get(day) ?? [];
              const placeLines = placesByDay.get(day) ?? [];
              const picked = pickDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setPickDay(picked ? null : day)}
                  className={`min-h-[132px] border-l border-zinc-100 p-1.5 text-left align-top first:border-l-0 dark:border-zinc-800 ${
                    picked ? "bg-violet-50 dark:bg-violet-950/30" : "bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                        isToday ? "bg-violet-600 text-white" : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      {day}
                    </span>
                  </div>
                  {placeLines.length > 0 && (
                    <p
                      className="mt-1 line-clamp-3 text-[10px] leading-snug text-emerald-900 dark:text-emerald-200"
                      title={placeLines.join("\n")}
                    >
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Where</span>
                      <span className="text-emerald-800 dark:text-emerald-300"> · {placeLines.join(" · ")}</span>
                    </p>
                  )}
                  <ul className="mt-1 space-y-0.5">
                    {evs.slice(0, 4).map((ev) => (
                      <li
                        key={ev.id}
                        className="truncate rounded px-1 py-0.5 text-[11px] leading-tight text-zinc-800 dark:text-zinc-200"
                        style={{ borderLeft: `3px solid ${ev.color}` }}
                        title={[ev.title, ev.location].filter(Boolean).join(" · ")}
                      >
                        <span className="block truncate">{ev.title}</span>
                        {ev.location && (
                          <span className="block truncate text-[10px] font-normal text-emerald-800 dark:text-emerald-300">
                            {ev.location}
                          </span>
                        )}
                      </li>
                    ))}
                    {evs.length > 4 && (
                      <li className="px-1 text-[10px] text-zinc-500">+{evs.length - 4} more</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {pickDay != null && (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {new Date(year, month, pickDay).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h3>

          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
              {planToken ? "Where they are (by time)" : "Where you are (by time)"}
            </p>
            {selectedSlots.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">No schedule in this range for this day.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedSlots.map((s, idx) => {
                  const place = placeLineFromSlot(s);
                  return (
                    <li
                      key={`${s.startUtc}-${s.endUtc}-${idx}`}
                      className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/25"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            s.busy
                              ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
                              : "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                          }`}
                        >
                          {s.busy ? "Busy" : "Free"}
                        </span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatSlotInterval(s)}</span>
                        {s.sourceColor && s.busy && (
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.sourceColor }} title={s.sourceName ?? ""} />
                        )}
                      </div>
                      {s.busy && s.eventTitle && (
                        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.eventTitle}</p>
                      )}
                      {s.busy && s.sourceName && (
                        <p className="text-xs text-zinc-500">{s.sourceName}</p>
                      )}
                      {place && (
                        <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
                          <span className="font-medium text-emerald-800 dark:text-emerald-400">Location: </span>
                          {place}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedLocs.length > 0 && (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {planToken ? "Their location blocks" : "Location blocks (raw)"}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {selectedLocs.map((w) => (
                  <li key={w.id}>
                    <span className="font-medium">{w.label}</span>
                    {w.address ? ` — ${w.address}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {planToken ? "Their calendar events" : "Calendar events"}
            </p>
            {selectedEvents.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">No events this day (in synced range).</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: ev.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{ev.title}</p>
                        <p className="text-xs text-zinc-500">{formatTimeRange(ev)}</p>
                        <p className="text-xs text-zinc-500">{ev.sourceName}</p>
                        {ev.location && (
                          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">{ev.location}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
