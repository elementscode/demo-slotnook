import { sql } from "@elements/app";
import { MeetingType } from "#app/shared/services/scheduling";

/** Test rows: a host with every day open 09:00 to 17:00 in `timeZone`, and one meeting type. */
export function makeHost(slug: string, timeZone = "UTC", durationMinutes = 60, bufferMinutes = 15) {
  let host = sql<{ id: string; slug: string; timeZone: string }>(`
    insert into users (email, passwordHash, name, slug, timeZone)
         values (${slug + "@test.dev"}, crypt('password123', genSalt('bf', 4)), ${"Host " + slug}, ${slug}, ${timeZone})
      returning id, slug, timeZone
  `).firstOrThrow();

  sql(`
    insert into availabilityRules (userId, weekday, startTime, endTime)
      select ${host.id}, d, '09:00', '17:00' from generate_series(0, 6) d
  `);

  let type = sql<MeetingType>(`
    insert into meetingTypes (userId, slug, name, durationMinutes, bufferMinutes)
         values (${host.id}, 'call', 'Call', ${durationMinutes}, ${bufferMinutes})
      returning *
  `).firstOrThrow();

  return { host, type };
}

/** `hhmm` on the host's calendar date `days` from today, as an instant. */
export function at(timeZone: string, days: number, hhmm: string): Date {
  return sql<{ t: Date }>(`
    select (((now() at time zone ${timeZone})::date + ${days}::int) + ${hhmm}::time) at time zone ${timeZone} as t
  `).firstOrThrow().t;
}

/** The host-local date `days` from today, as "2026-10-01". */
export function dateIn(timeZone: string, days: number): string {
  return sql<{ d: string }>(`
    select (((now() at time zone ${timeZone})::date + ${days}::int))::text as d
  `).firstOrThrow().d;
}

export function slotsOn(typeId: string, timeZone: string, days: number): Date[] {
  return sql<{ startsAt: Date }>(`
    select startsAt from openSlots(${typeId}::uuid,
                                   ${at(timeZone, days, "00:00")}::timestamptz,
                                   ${at(timeZone, days + 1, "00:00")}::timestamptz)
  `).all().map((r) => r.startsAt);
}
