import { Job, email, sql, getAppUrl, File } from "@elements/app";
import BookingUpdateEmail from "#app/emails/booking-update";
import { buildIcs } from "#app/shared/lib/ics";
import { formatWhen, formatDuration, zoneName, zoneAbbr } from "#app/shared/lib/time";

export type BookingEmailKind =
  | "confirmed"
  | "rescheduled"
  | "cancelled-by-host"
  | "cancelled-by-guest"
  | "reminder";

export interface BookingEmailJobFields {
  bookingId: string;
  kind: BookingEmailKind;
}

interface BookingEmailRow {
  id: string;
  token: string;
  sequence: number;
  startsAt: Date;
  endsAt: Date;
  guestName: string;
  guestEmail: string;
  guestNote: string;
  guestTimeZone: string;
  meetingName: string;
  meetingSlug: string;
  durationMinutes: number;
  hostName: string;
  hostEmail: string;
  hostSlug: string;
}

interface Copy {
  subject: string;
  heading: string;
  intro: string;
}

function copyFor(kind: BookingEmailKind, b: BookingEmailRow): Copy {
  let firstName = b.guestName.split(" ")[0];
  switch (kind) {
    case "confirmed":
      return {
        subject: `Confirmed: ${b.meetingName} with ${b.hostName}`,
        heading: "You're booked",
        intro: `Hi ${firstName}, your ${b.meetingName.toLowerCase()} with ${b.hostName} is confirmed. The invite is attached for your calendar.`,
      };

    case "rescheduled":
      return {
        subject: `New time: ${b.meetingName} with ${b.hostName}`,
        heading: "Your booking moved",
        intro: `Hi ${firstName}, your ${b.meetingName.toLowerCase()} with ${b.hostName} has a new time. The attached invite replaces the old one.`,
      };

    case "cancelled-by-host":
      return {
        subject: `Cancelled: ${b.meetingName} with ${b.hostName}`,
        heading: "Your booking was cancelled",
        intro: `Hi ${firstName}, ${b.hostName} had to cancel your ${b.meetingName.toLowerCase()}. You can pick another time below.`,
      };

    case "cancelled-by-guest":
      return {
        subject: `Cancelled: ${b.meetingName} with ${b.hostName}`,
        heading: "Booking cancelled",
        intro: `Hi ${firstName}, your ${b.meetingName.toLowerCase()} with ${b.hostName} is cancelled. The attached file removes it from your calendar.`,
      };

    case "reminder":
      return {
        subject: `Tomorrow: ${b.meetingName} with ${b.hostName}`,
        heading: "See you tomorrow",
        intro: `Hi ${firstName}, a reminder that your ${b.meetingName.toLowerCase()} with ${b.hostName} is coming up.`,
      };
  }
}

/** Renders and sends one guest email about a booking, with its calendar file. */
export class BookingEmailJob extends Job<BookingEmailJobFields> {
  static maxAttempts = 5;

  run() {
    let { bookingId, kind } = this.fields;
    let b = sql<BookingEmailRow>(`
      select b.id, b.token, b.sequence, b.startsAt, b.endsAt,
             b.guestName, b.guestEmail, b.guestNote, b.guestTimeZone,
             m.name as meetingName, m.slug as meetingSlug, m.durationMinutes,
             u.name as hostName, u.email as hostEmail, u.slug as hostSlug
        from bookings b
        join meetingTypes m on m.id = b.meetingTypeId
        join users u on u.id = b.userId
       where b.id = ${bookingId}
    `).first();

    if (!b) {
      return;
    }

    let cancelled = kind === "cancelled-by-host" || kind === "cancelled-by-guest";
    let copy = copyFor(kind, b);
    let tz = b.guestTimeZone;

    let ics = buildIcs({
      uid: `${b.id}@slotnook`,
      sequence: b.sequence,
      method: cancelled ? "CANCEL" : "REQUEST",
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      summary: `${b.meetingName} with ${b.hostName}`,
      description: b.guestNote ? `Note: ${b.guestNote}` : `Booked with slotnook.`,
      url: `${getAppUrl()}/booking/${b.token}`,
      organizerName: b.hostName,
      organizerEmail: b.hostEmail,
      attendeeName: b.guestName,
      attendeeEmail: b.guestEmail,
    });

    let data = new TextEncoder().encode(ics);

    email({
      to: b.guestEmail,
      replyTo: b.hostEmail,
      subject: copy.subject,
      body: new BookingUpdateEmail({
        heading: copy.heading,
        intro: copy.intro,
        meetingName: b.meetingName,
        hostName: b.hostName,
        when: formatWhen(b.startsAt, b.endsAt, tz),
        zone: `${zoneName(tz)} (${zoneAbbr(b.startsAt, tz)})`,
        duration: formatDuration(b.durationMinutes),
        note: b.guestNote,
        cancelled,
        token: b.token,
        bookAgainPath: `/${b.hostSlug}/${b.meetingSlug}`,
      }),
      attachments: [
        new File({
          name: cancelled ? "cancel.ics" : "invite.ics",
          size: data.length,
          contentType: `text/calendar; method=${cancelled ? "CANCEL" : "REQUEST"}; charset=utf-8`,
          data,
          lastModified: new Date(),
        }),
      ],
    });
  }
}
