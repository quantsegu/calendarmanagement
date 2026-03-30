export type EventRow = {
  startUtc: Date;
  endUtc: Date;
  title: string;
  location: string | null;
  isBusy: boolean;
  color: string;
  sourceName: string;
};

export type LocationRow = {
  startUtc: Date;
  endUtc: Date;
  label: string;
  address: string | null;
};

export type ScheduleSlot = {
  startUtc: string;
  endUtc: string;
  busy: boolean;
  eventTitle: string | null;
  eventLocation: string | null;
  sourceName: string | null;
  sourceColor: string | null;
  /** Where you are (location window or event), for planners */
  placeLabel: string | null;
  placeDetail: string | null;
};

function addBoundaries(set: Set<number>, a: Date, b: Date) {
  set.add(a.getTime());
  set.add(b.getTime());
}

function locationWindowAt(t: number, windows: LocationRow[]): LocationRow | null {
  const containing = windows.filter((w) => w.startUtc.getTime() <= t && w.endUtc.getTime() >= t);
  if (containing.length === 0) return null;
  containing.sort(
    (a, b) =>
      a.endUtc.getTime() -
      a.startUtc.getTime() -
      (b.endUtc.getTime() - b.startUtc.getTime()),
  );
  return containing[0]!;
}

function overlappingEvents(t0: number, t1: number, events: EventRow[]) {
  return events.filter(
    (e) =>
      e.isBusy && e.startUtc.getTime() < t1 && e.endUtc.getTime() > t0,
  );
}

export function buildScheduleSlots(
  rangeStart: Date,
  rangeEnd: Date,
  events: EventRow[],
  windows: LocationRow[],
): ScheduleSlot[] {
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  const bounds = new Set<number>([rs, re]);

  for (const e of events) {
    if (!e.isBusy) continue;
    const s = e.startUtc.getTime();
    const en = e.endUtc.getTime();
    if (en <= rs || s >= re) continue;
    addBoundaries(bounds, new Date(Math.max(s, rs)), new Date(Math.min(en, re)));
  }

  for (const w of windows) {
    const s = w.startUtc.getTime();
    const en = w.endUtc.getTime();
    if (en <= rs || s >= re) continue;
    addBoundaries(bounds, new Date(Math.max(s, rs)), new Date(Math.min(en, re)));
  }

  const sorted = [...bounds].filter((t) => t >= rs && t <= re).sort((a, b) => a - b);
  const slots: ScheduleSlot[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const t0 = sorted[i]!;
    const t1 = sorted[i + 1]!;
    if (t0 >= t1) continue;

    const mid = t0 + (t1 - t0) / 2;
    const busyList = overlappingEvents(t0, t1, events);
    const win = locationWindowAt(mid, windows);

    if (busyList.length > 0) {
      busyList.sort((a, b) => b.endUtc.getTime() - b.startUtc.getTime() - (a.endUtc.getTime() - a.startUtc.getTime()));
      const top = busyList[0]!;
      const placeFromEvent = top.location
        ? { label: top.title, detail: top.location }
        : { label: win?.label ?? top.title, detail: win?.address ?? null };
      slots.push({
        startUtc: new Date(t0).toISOString(),
        endUtc: new Date(t1).toISOString(),
        busy: true,
        eventTitle: top.title,
        eventLocation: top.location,
        sourceName: top.sourceName,
        sourceColor: top.color,
        placeLabel: placeFromEvent.label,
        placeDetail: placeFromEvent.detail,
      });
    } else {
      slots.push({
        startUtc: new Date(t0).toISOString(),
        endUtc: new Date(t1).toISOString(),
        busy: false,
        eventTitle: null,
        eventLocation: null,
        sourceName: null,
        sourceColor: null,
        placeLabel: win?.label ?? null,
        placeDetail: win?.address ?? null,
      });
    }
  }

  return mergeAdjacentSlots(slots);
}

function mergeAdjacentSlots(slots: ScheduleSlot[]): ScheduleSlot[] {
  const out: ScheduleSlot[] = [];
  for (const s of slots) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.busy === s.busy &&
      prev.eventTitle === s.eventTitle &&
      prev.eventLocation === s.eventLocation &&
      prev.sourceName === s.sourceName &&
      prev.sourceColor === s.sourceColor &&
      prev.placeLabel === s.placeLabel &&
      prev.placeDetail === s.placeDetail &&
      prev.endUtc === s.startUtc
    ) {
      prev.endUtc = s.endUtc;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}
