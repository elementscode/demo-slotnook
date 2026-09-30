import { test, assert, equal, sql } from "@elements/app";
import { makeHost } from "#app/shared/lib/fixtures";
import { SendRemindersJob } from "./send-reminders";

function insertBooking(userId: string, typeId: string, startsIn: string, createdAgo: string): string {
  return sql<{ id: string }>(`
    insert into bookings (userId, meetingTypeId, guestName, guestEmail, startsAt, endsAt, createdAt)
         values (${userId}, ${typeId}, 'Guest', 'guest@example.com',
                 now() + ${startsIn}::interval, now() + ${startsIn}::interval + interval '1 hour',
                 now() - ${createdAgo}::interval)
      returning id
  `).firstOrThrow().id;
}

function reminded(id: string): boolean {
  return sql<{ sent: boolean }>(`select reminderSentAt is not null as sent from bookings where id = ${id}`).firstOrThrow().sent;
}

test("send reminders", () => {
  test("claims bookings starting within a day, once", () => {
    let { host, type } = makeHost("remind");
    let soon = insertBooking(host.id, type.id, "20 hours", "3 days");
    let later = insertBooking(host.id, type.id, "30 hours", "3 days");
    let lastMinute = insertBooking(host.id, type.id, "5 hours", "1 hour");

    new SendRemindersJob({}).run();

    equal(reminded(soon), true);
    equal(reminded(later), false);
    // Booked a few hours ahead: marked so the sweep skips it, with no second email.
    equal(reminded(lastMinute), true);
  });

  test("skips cancelled bookings", () => {
    let { host, type } = makeHost("remind-cancelled");
    let id = insertBooking(host.id, type.id, "20 hours", "3 days");
    sql(`update bookings set status = 'cancelled' where id = ${id}`);

    new SendRemindersJob({}).run();
    assert(!reminded(id));
  });
});
