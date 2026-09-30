import { Job, sql } from "@elements/app";
import { BookingEmailJob } from "#app/jobs/booking-email";

/**
 * Claims every confirmed booking starting within 24 hours that has not had a
 * reminder, and queues one email each. A booking made less than a day ahead
 * already has its confirmation, so it is marked without a second email.
 */
export class SendRemindersJob extends Job {
  run() {
    let due = sql<{ id: string; remind: boolean }>(`
      update bookings
         set reminderSentAt = now()
       where status = 'confirmed'
         and reminderSentAt is null
         and startsAt > now()
         and startsAt <= now() + interval '24 hours'
      returning id, createdAt < startsAt - interval '24 hours' as remind
    `).all();

    for (let b of due) {
      if (b.remind) {
        new BookingEmailJob({ bookingId: b.id, kind: "reminder" }).schedule();
      }
    }
  }
}
