const HEX = /^#[0-9A-Fa-f]{6}$/;

export function parseItemBody(raw: unknown): {
  title: string;
  startUtc: Date;
  endUtc: Date;
  location: string | null;
  description: string | null;
  isBusy: boolean;
  color: string;
} | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "JSON body required" };
  }
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title) {
    return { error: "title is required" };
  }
  if (title.length > 500) {
    return { error: "title too long (max 500)" };
  }

  const startUtc = typeof o.startUtc === "string" ? new Date(o.startUtc) : null;
  const endUtc = typeof o.endUtc === "string" ? new Date(o.endUtc) : null;
  if (!startUtc || Number.isNaN(startUtc.getTime())) {
    return { error: "startUtc must be a valid ISO-8601 datetime" };
  }
  if (!endUtc || Number.isNaN(endUtc.getTime())) {
    return { error: "endUtc must be a valid ISO-8601 datetime" };
  }
  if (endUtc <= startUtc) {
    return { error: "endUtc must be after startUtc" };
  }

  const location =
    typeof o.location === "string" && o.location.trim() ? o.location.trim().slice(0, 1000) : null;
  const description =
    typeof o.description === "string" && o.description.trim()
      ? o.description.trim().slice(0, 5000)
      : null;

  const isBusy = o.isBusy === false ? false : true;

  let color = typeof o.color === "string" ? o.color.trim() : "#64748b";
  if (!HEX.test(color)) {
    color = "#64748b";
  }

  return { title, startUtc, endUtc, location, description, isBusy, color };
}

export function serializeManualItem(m: {
  id: string;
  title: string;
  startUtc: Date;
  endUtc: Date;
  location: string | null;
  description: string | null;
  isBusy: boolean;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: m.id,
    kind: "manual" as const,
    title: m.title,
    startUtc: m.startUtc.toISOString(),
    endUtc: m.endUtc.toISOString(),
    location: m.location,
    description: m.description,
    isBusy: m.isBusy,
    color: m.color,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}
