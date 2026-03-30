"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SYNC_FORWARD_DAYS } from "@/lib/sync-range";

type SourceKind = "ICAL" | "GOOGLE" | "MICROSOFT" | "ZOHO";

type Source = {
  id: string;
  kind: SourceKind;
  name: string;
  icalUrl: string | null;
  color: string;
  eventCount: number;
  accountHint: string | null;
  calendarId: string | null;
};

type Loc = { id: string; label: string; address: string | null; startUtc: string; endUtc: string };
type Share = { id: string; token: string; label: string | null };

type AuthConfig = { google: boolean; microsoft: boolean; zoho: boolean };

function bumpCalendarView() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("calendar-refresh"));
  }
}

const cred: RequestInit = { credentials: "include" };

function kindLabel(k: SourceKind) {
  switch (k) {
    case "ICAL":
      return "ICS";
    case "GOOGLE":
      return "Google";
    case "MICROSOFT":
      return "Microsoft";
    case "ZOHO":
      return "Zoho";
  }
}

export function Dashboard() {
  const [sources, setSources] = useState<Source[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  const [oauthName, setOauthName] = useState("Work calendar");
  const [oauthColor, setOauthColor] = useState("#6366f1");
  const [oauthCalendarId, setOauthCalendarId] = useState("");
  const [oauthZohoUid, setOauthZohoUid] = useState("");

  const [locLabel, setLocLabel] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locStart, setLocStart] = useState("");
  const [locEnd, setLocEnd] = useState("");

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const [s, l, sh, ac] = await Promise.all([
        fetch("/api/sources", cred).then((r) => r.json()),
        fetch("/api/locations", cred).then((r) => r.json()),
        fetch("/api/share", cred).then((r) => r.json()),
        fetch("/api/auth/config", cred).then((r) => r.json()),
      ]);
      setSources(Array.isArray(s) ? s : []);
      setLocs(Array.isArray(l) ? l : []);
      setShares(Array.isArray(sh) ? sh : []);
      setAuthConfig(ac as AuthConfig);
    } catch {
      setErr("Failed to load data");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const oauth = q.get("oauth");
    const message = q.get("message");
    if (oauth === "connected") {
      setMsg("Calendar connected. Use Sync to pull the next " + SYNC_FORWARD_DAYS + " days of events.");
      window.history.replaceState({}, "", window.location.pathname);
      refresh();
      bumpCalendarView();
    } else if (oauth === "error" && message) {
      setErr(decodeURIComponent(message));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refresh]);

  const connectHref = useCallback(
    (provider: "google" | "microsoft" | "zoho") => {
      const p = new URLSearchParams({
        name: oauthName.trim() || "Calendar",
        color: oauthColor,
      });
      const cal = oauthCalendarId.trim();
      if (cal) p.set("calendarId", cal);
      if (provider === "zoho" && oauthZohoUid.trim()) p.set("zohoCalendarUid", oauthZohoUid.trim());
      return `/api/auth/${provider}/start?${p.toString()}`;
    },
    [oauthName, oauthColor, oauthCalendarId, oauthZohoUid],
  );

  const oauthReady = useMemo(() => {
    if (!authConfig) return false;
    return authConfig.google || authConfig.microsoft || authConfig.zoho;
  }, [authConfig]);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/sources", {
      ...cred,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "ICAL", name: newName, icalUrl: newUrl, color: newColor }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr((j as { error?: string }).error ?? "Could not add source");
      return;
    }
    setNewName("");
    setNewUrl("");
    setMsg("ICS source added. Sync it to import events.");
    refresh();
    bumpCalendarView();
  }

  async function syncOne(id: string) {
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/sources/${id}/sync`, { ...cred, method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Sync failed");
      return;
    }
    setMsg(`Imported ${(j as { imported?: number }).imported ?? 0} events (next ${SYNC_FORWARD_DAYS} days)`);
    refresh();
    bumpCalendarView();
  }

  async function syncAll() {
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/sync", { ...cred, method: "POST" });
    const j = await res.json().catch(() => ({}));
    const results = (j as { results?: { ok: boolean; error?: string; imported?: number }[] }).results ?? [];
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      setErr(failed.map((f) => f.error).join("; "));
    } else {
      setMsg(`All calendars synced (next ${SYNC_FORWARD_DAYS} days)`);
    }
    refresh();
    bumpCalendarView();
  }

  async function removeSource(id: string) {
    await fetch(`/api/sources/${id}`, { ...cred, method: "DELETE" });
    refresh();
    bumpCalendarView();
  }

  async function addLoc(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const start = locStart ? new Date(locStart).toISOString() : "";
    const end = locEnd ? new Date(locEnd).toISOString() : "";
    const res = await fetch("/api/locations", {
      ...cred,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: locLabel, address: locAddress || undefined, startUtc: start, endUtc: end }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr((j as { error?: string }).error ?? "Could not save location");
      return;
    }
    setLocLabel("");
    setLocAddress("");
    setLocStart("");
    setLocEnd("");
    setMsg("Location block saved");
    refresh();
    bumpCalendarView();
  }

  async function removeLoc(id: string) {
    await fetch(`/api/locations/${id}`, { ...cred, method: "DELETE" });
    refresh();
    bumpCalendarView();
  }

  async function createShare() {
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/share", {
      ...cred,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      setErr("Could not create link");
      return;
    }
    setMsg("New planner link created — copy the URL below");
    refresh();
  }

  function copyPlanUrl(token: string) {
    const url = `${window.location.origin}/plan/${token}`;
    void navigator.clipboard.writeText(url);
    setMsg("Copied planner URL to clipboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Connections & sharing</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          OAuth (Google / Microsoft / Zoho) or ICS links. Sync window: next{" "}
          <strong>{SYNC_FORWARD_DAYS} days</strong>. Location blocks appear on the calendar above.
        </p>
      </header>

      {(msg || err) && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            err ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          }`}
        >
          {err ?? msg}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Calendar sources</h2>
          <button
            type="button"
            onClick={() => syncAll()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Sync all
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/50">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Connect with OAuth</p>
          <p className="mt-1 text-xs text-zinc-500">
            Register redirect URI <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{`{APP_BASE_URL}/api/auth/google/callback`}</code>{" "}
            (and the same pattern for <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">microsoft</code> /{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">zoho</code>) in each developer console. Set{" "}
            <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">APP_BASE_URL</code> in <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">.env</code>.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Display name for this connection"
              value={oauthName}
              onChange={(e) => setOauthName(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              Color
              <input type="color" value={oauthColor} onChange={(e) => setOauthColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border-0" />
            </label>
            <input
              className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Optional: Google/Microsoft calendar ID (default: primary / default calendar)"
              value={oauthCalendarId}
              onChange={(e) => setOauthCalendarId(e.target.value)}
            />
            <input
              className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Optional: Zoho calendar uid (if empty, first available calendar is used)"
              value={oauthZohoUid}
              onChange={(e) => setOauthZohoUid(e.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {authConfig?.google && (
              <a
                href={connectHref("google")}
                className="inline-flex rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
              >
                Connect Google
              </a>
            )}
            {authConfig?.microsoft && (
              <a
                href={connectHref("microsoft")}
                className="inline-flex rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
              >
                Connect Microsoft
              </a>
            )}
            {authConfig?.zoho && (
              <a
                href={connectHref("zoho")}
                className="inline-flex rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-600"
              >
                Connect Zoho
              </a>
            )}
            {authConfig && !oauthReady && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No OAuth clients configured. Add API credentials to <code className="rounded bg-amber-100 px-1 dark:bg-amber-950">.env</code> and restart the dev server.
              </p>
            )}
          </div>
        </div>

        <ul className="mt-6 space-y-3">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">{kindLabel(s.kind)}</span>
                    {s.accountHint ? ` · ${s.accountHint}` : ""}
                    {s.calendarId && s.kind !== "ICAL" ? ` · ${s.calendarId.slice(0, 24)}${s.calendarId.length > 24 ? "…" : ""}` : ""}
                    {" · "}
                    {s.eventCount} cached
                  </p>
                  {s.kind === "ICAL" && s.icalUrl && (
                    <p className="truncate text-xs text-zinc-400" title={s.icalUrl}>
                      {s.icalUrl}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => syncOne(s.id)} className="text-sm text-violet-600 hover:underline dark:text-violet-400">
                  Sync
                </button>
                <button type="button" onClick={() => removeSource(s.id)} className="text-sm text-zinc-500 hover:text-red-600">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={addSource} className="mt-6 space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-sm font-medium">Add ICS URL (no OAuth)</p>
          <p className="text-xs text-zinc-500">Secret iCal link from Google, Outlook, Apple, etc.</p>
          <input
            className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            placeholder="Name (e.g. Shared team ICS)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            placeholder="https://…/basic.ics"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              Color
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-8 w-14 cursor-pointer rounded border-0" />
            </label>
            <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              Add ICS source
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Location over time</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          When you are not in a meeting, planners still see these blocks (office, city, travel). During meetings, event
          location overrides when present.
        </p>

        <ul className="mt-4 space-y-2">
          {locs.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/60">
              <div>
                <p className="font-medium">{w.label}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(w.startUtc).toLocaleString()} → {new Date(w.endUtc).toLocaleString()}
                </p>
                {w.address && <p className="text-xs text-zinc-600 dark:text-zinc-400">{w.address}</p>}
              </div>
              <button type="button" onClick={() => removeLoc(w.id)} className="text-zinc-500 hover:text-red-600">
                Remove
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addLoc} className="mt-6 space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-sm font-medium">Add location window</p>
          <input
            className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            placeholder="Label (e.g. NYC office)"
            value={locLabel}
            onChange={(e) => setLocLabel(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            placeholder="Address or notes (optional)"
            value={locAddress}
            onChange={(e) => setLocAddress(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-zinc-500">
              Start
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                value={locStart}
                onChange={(e) => setLocStart(e.target.value)}
              />
            </label>
            <label className="text-xs text-zinc-500">
              End
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                value={locEnd}
                onChange={(e) => setLocEnd(e.target.value)}
              />
            </label>
          </div>
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Save location block
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium">Planner links</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Share a read-only link. Anyone with the URL sees merged availability and location hints (default range on the
          planner page is two weeks; API accepts custom <code className="text-xs">from</code> / <code className="text-xs">to</code>).
        </p>
        <button
          type="button"
          onClick={() => createShare()}
          className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Create new link
        </button>
        <ul className="mt-4 space-y-2">
          {shares.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/60">
              <code className="max-w-[200px] truncate text-xs text-zinc-600 dark:text-zinc-400">{l.token.slice(0, 12)}…</code>
              <button type="button" onClick={() => copyPlanUrl(l.token)} className="text-violet-600 hover:underline dark:text-violet-400">
                Copy URL
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
