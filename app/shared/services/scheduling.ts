import { Channel, sql, tx, session, NotFoundError, ValidationError, ForbiddenError } from "@elements/app";
import { BookingEmailJob, BookingEmailKind } from "#app/jobs/booking-email";
import { isTimeZone } from "#app/shared/lib/time";

export interface Host {
  id: string;
  name: string;
  slug: string;
  headline: string;
  timeZone: string;
}

export interface MeetingType {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  active: boolean;
}

export interface Booking {
  id: string;
  userId: string;
  meetingTypeId: string;
  guestName: string;
  guestEmail: string;
  guestNote: string;
  guestTimeZone: string;
  startsAt: Date;
  endsAt: Date;
  bufferMinutes: number;
  status: "confirmed" | "cancelled";
  token: string;
  cancelledAt: Date | null;
}

/**
 * What an open booking page needs to know when a host's calendar changes.
 * "taken" carries the interval so the page can drop the slots it blocks
 * without a round trip; anything else means re-read the open slots.
 */
export interface SlotChange {
  userId: string;
  op: "taken" | "freed" | "changed";
  startsAt: Date;
  endsAt: Date;
  bufferMinutes: number;
}

export interface BookingForm {
  meetingTypeId: string;
  startsAt: Date;
  guestName: string;
  guestEmail: string;
  guestNote: string;
  guestTimeZone: string;
}

export const SLOT_WINDOW_DAYS = 60;

export const slotChanges = new Channel<SlotChange>("slot-changes");

export function loadOpenSlots(meetingTypeId: string, ignoreBookingId: string | null = null): Date[] {
  return sql<{ startsAt: Date }>(`
    select startsAt
      from openSlots(${meetingTypeId}::uuid, now(), now() + make_interval(days => ${SLOT_WINDOW_DAYS}), ${ignoreBookingId}::uuid)
  `).all().map((r) => r.startsAt);
}

/**
 * The open start times for a booking page. A reschedule passes the booking's
 * token so its current time does not block the slots around it.
 */
/** @rpc */
export function fetchOpenSlots(meetingTypeId: string, rescheduleToken: string = ""): Date[] {
  let ignore = rescheduleToken
    ? sql<{ id: string }>(`select id from bookings where token = ${rescheduleToken}`).first()?.id ?? null
    : null;

  return loadOpenSlots(meetingTypeId, ignore);
}

export function loadHostBySlug(slug: string): Host {
  let host = sql<Host>(`
    select id, name, slug, headline, timeZone from users where slug = ${slug.toLowerCase()}
  `).first();

  if (!host) {
    throw new NotFoundError("no one here by that name");
  }

  return host;
}

export function loadMeetingType(hostId: string, slug: string): MeetingType {
  let type = sql<MeetingType>(`
    select * from meetingTypes where userId = ${hostId} and slug = ${slug.toLowerCase()} and active
  `).first();

  if (!type) {
    throw new NotFoundError("that meeting type is not available");
  }

  return type;
}

export function loadBookingByToken(token: string): Booking {
  let booking = sql<Booking>(`select * from bookings where token = ${token}`).first();
  if (!booking) {
    throw new NotFoundError("that booking link is not valid");
  }

  return booking;
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/**
 * Checks that `startsAt` is one of the type's open slots, with the host row
 * locked so two guests racing for the same time cannot both pass.
 */
function claimSlot(type: MeetingType, startsAt: Date, ignoreBookingId: string | null) {
  sql(`select id from users where id = ${type.userId} for update`);

  let open = !sql(`
    select 1
      from openSlots(${type.id}::uuid, ${startsAt}::timestamptz, ${startsAt}::timestamptz + interval '1 second', ${ignoreBookingId}::uuid)
     where startsAt = ${startsAt}::timestamptz
  `).empty();

  if (!open) {
    throw new ValidationError("That time was just taken. Please pick another.");
  }
}

function notifyChange(op: SlotChange["op"], b: { userId: string; startsAt: Date; endsAt: Date; bufferMinutes: number }) {
  slotChanges.notify({ userId: b.userId, op, startsAt: b.startsAt, endsAt: b.endsAt, bufferMinutes: b.bufferMinutes });
}

/** @rpc */
export function bookSlot(form: BookingForm): { token: string } {
  let guestName = form.guestName.trim();
  let guestEmail = form.guestEmail.trim().toLowerCase();
  let guestNote = form.guestNote.trim().slice(0, 2000);

  let errors: Record<string, string[]> = {};
  if (!guestName) {
    errors.guestName = ["Enter your name"];
  }

  if (!isEmail(guestEmail)) {
    errors.guestEmail = ["Enter a valid email address"];
  }

  if (Object.keys(errors).length) {
    throw new ValidationError(errors);
  }

  let guestTimeZone = isTimeZone(form.guestTimeZone) ? form.guestTimeZone : "UTC";

  let type = sql<MeetingType>(`select * from meetingTypes where id = ${form.meetingTypeId} and active`).first();
  if (!type) {
    throw new NotFoundError("that meeting type is not available");
  }

  let booking = tx(() => {
    claimSlot(type, form.startsAt, null);

    let b = sql<Booking>(`
      insert into bookings (userId, meetingTypeId, guestName, guestEmail, guestNote, guestTimeZone, startsAt, endsAt, bufferMinutes)
           values (${type.userId}, ${type.id}, ${guestName}, ${guestEmail}, ${guestNote}, ${guestTimeZone},
                   ${form.startsAt}::timestamptz, ${form.startsAt}::timestamptz + make_interval(mins => ${type.durationMinutes}), ${type.bufferMinutes})
        returning *
    `).firstOrThrow("insert returned no row");

    new BookingEmailJob({ bookingId: b.id, kind: "confirmed" }).schedule();

    return b;
  });

  notifyChange("taken", booking);

  return { token: booking.token };
}

function cancel(booking: Booking, kind: BookingEmailKind) {
  if (booking.status === "cancelled") {
    return;
  }

  tx(() => {
    sql(`
      update bookings
         set status = 'cancelled', cancelledAt = now(), sequence = sequence + 1
       where id = ${booking.id}
    `);

    new BookingEmailJob({ bookingId: booking.id, kind }).schedule();
  });

  notifyChange("freed", booking);
}

function move(booking: Booking, startsAt: Date): Booking {
  if (booking.status === "cancelled") {
    throw new ValidationError("This booking was cancelled.");
  }

  let type = sql<MeetingType>(`select * from meetingTypes where id = ${booking.meetingTypeId}`).firstOrThrow("meeting type missing");

  let moved = tx(() => {
    claimSlot({ ...type, active: true }, startsAt, booking.id);

    let b = sql<Booking>(`
      update bookings
         set startsAt = ${startsAt}::timestamptz,
             endsAt = ${startsAt}::timestamptz + make_interval(mins => ${type.durationMinutes}),
             sequence = sequence + 1,
             reminderSentAt = null
       where id = ${booking.id}
      returning *
    `).firstOrThrow("update returned no row");

    new BookingEmailJob({ bookingId: b.id, kind: "rescheduled" }).schedule();

    return b;
  });

  notifyChange("freed", booking);
  notifyChange("taken", moved);

  return moved;
}

/** @rpc */
export function guestCancel(token: string) {
  cancel(loadBookingByToken(token), "cancelled-by-guest");
}

/** @rpc */
export function guestReschedule(token: string, startsAt: Date) {
  move(loadBookingByToken(token), startsAt);
}

function ownBooking(id: string): Booking {
  let userId = session.getOrThrow("userId");
  let booking = sql<Booking>(`select * from bookings where id = ${id}`).first();
  if (!booking) {
    throw new NotFoundError("booking not found");
  }

  if (booking.userId !== userId) {
    throw new ForbiddenError();
  }

  return booking;
}

/** @rpc */
export function hostCancel(id: string) {
  cancel(ownBooking(id), "cancelled-by-host");
}

/** @rpc */
export function hostReschedule(id: string, startsAt: Date) {
  move(ownBooking(id), startsAt);
}

/** Tells open booking pages to re-read a host's slots after their hours change. */
export function notifyHoursChanged(userId: string) {
  let now = new Date();
  slotChanges.notify({ userId, op: "changed", startsAt: now, endsAt: now, bufferMinutes: 0 });
}
