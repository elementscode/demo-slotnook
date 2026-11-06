/**
 * Formatting in a named IANA zone. Runs in the browser and on the server, so
 * the guest sees their own zone and emails carry each reader's.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let key = timeZone + JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, ...options });
    formatters.set(key, f);
  }

  return f;
}

/** "2026-10-01", the calendar date of `d` in `timeZone`. */
export function dayKey(d: Date, timeZone: string): string {
  let parts = formatter(timeZone, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  let get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "9:30 AM" */
export function formatTime(d: Date, timeZone: string): string {
  return formatter(timeZone, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** "Thursday, October 1" */
export function formatDay(d: Date, timeZone: string): string {
  return formatter(timeZone, { weekday: "long", month: "long", day: "numeric" }).format(d);
}

/** "Thu, Oct 1" */
export function formatShortDay(d: Date, timeZone: string): string {
  return formatter(timeZone, { weekday: "short", month: "short", day: "numeric" }).format(d);
}

/** "Thursday, October 1, 2026 · 10:00 AM – 11:00 AM" */
export function formatWhen(start: Date, end: Date, timeZone: string): string {
  let day = formatter(timeZone, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(start);

  return `${day} · ${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`;
}

/** "PDT", or "GMT+2" where the zone has no common abbreviation. */
export function zoneAbbr(d: Date, timeZone: string): string {
  let parts = formatter(timeZone, { timeZoneName: "short" }).formatToParts(d);

  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

/** "America/Los_Angeles" reads as "America / Los Angeles". */
export function zoneName(timeZone: string): string {
  return timeZone.replaceAll("_", " ").replaceAll("/", " / ");
}

export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function allTimeZones(): string[] {
  let zones = Intl.supportedValuesOf("timeZone");

  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

/** "2026-10" for a "2026-10-01" day key. */
export function monthKey(day: string): string {
  return day.slice(0, 7);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  let h = Math.floor(minutes / 60);
  let m = minutes % 60;

  return m ? `${h} hr ${m} min` : `${h} hr`;
}
