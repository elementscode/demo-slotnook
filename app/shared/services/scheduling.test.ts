import { test, assert, equal, sql, session, ValidationError, ForbiddenError } from "@elements/app";
import { makeHost, at, dateIn, slotsOn } from "#app/shared/lib/fixtures";
import { bookSlot, guestCancel, guestReschedule, hostCancel, hostReschedule, fetchOpenSlots } from "./scheduling";

function guest(typeId: string, startsAt: Date, email = "guest@example.com") {
  return {
    meetingTypeId: typeId,
    startsAt,
    guestName: "Grace Hopper",
    guestEmail: email,
    guestNote: "  hello  ",
    guestTimeZone: "America/New_York",
  };
}

function times(slots: Date[], timeZone: string): string[] {
  return slots.map((d) => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(d));
}

test("open slots", () => {
  test("follow weekly hours in the host's zone", () => {
    let { type } = makeHost("tokyo", "Asia/Tokyo");
    let slots = slotsOn(type.id, "Asia/Tokyo", 2);
    equal(times(slots, "Asia/Tokyo"), ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]);
  });

  test("an unavailable override closes the day", () => {
    let { host, type } = makeHost("off");
    sql(`insert into dateOverrides (userId, date) values (${host.id}, ${dateIn("UTC", 2)}::date)`);
    equal(slotsOn(type.id, "UTC", 2).length, 0);
    assert(slotsOn(type.id, "UTC", 3).length > 0, "the next day is still open");
  });

  test("custom override hours replace the weekly hours", () => {
    let { host, type } = makeHost("late");
    sql(`insert into dateOverrides (userId, date, startTime, endTime) values (${host.id}, ${dateIn("UTC", 2)}::date, '18:00', '20:00')`);
    equal(times(slotsOn(type.id, "UTC", 2), "UTC"), ["18:00", "19:00"]);
  });

  test("a booking blocks its time plus the buffer", () => {
    let { type } = makeHost("buffer");
    bookSlot(guest(type.id, at("UTC", 2, "11:00")));
    // 60 minute meetings with a 15 minute buffer: 10:00 ends too close, 12:00 starts too close.
    equal(times(slotsOn(type.id, "UTC", 2), "UTC"), ["09:00", "13:00", "14:00", "15:00", "16:00"]);
  });

  test("a hidden meeting type has no slots", () => {
    let { type } = makeHost("hidden");
    sql(`update meetingTypes set active = false where id = ${type.id}`);
    equal(fetchOpenSlots(type.id).length, 0);
  });
});

test("booking", () => {
  test("creates a confirmed booking and trims the note", () => {
    let { type } = makeHost("book");
    let { token } = bookSlot(guest(type.id, at("UTC", 2, "10:00")));
    let b = sql<{ status: string; guestNote: string; guestTimeZone: string }>(`select * from bookings where token = ${token}`).firstOrThrow();
    equal(b.status, "confirmed");
    equal(b.guestNote, "hello");
    equal(b.guestTimeZone, "America/New_York");
  });

  test("the same time cannot be booked twice", () => {
    let { type } = makeHost("twice");
    let startsAt = at("UTC", 2, "10:00");
    bookSlot(guest(type.id, startsAt));

    let threw = false;
    try {
      bookSlot(guest(type.id, startsAt, "second@example.com"));
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw, "second booking should fail");
  });

  test("a time outside the host's hours is rejected", () => {
    let { type } = makeHost("night");
    let threw = false;
    try {
      bookSlot(guest(type.id, at("UTC", 2, "03:00")));
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw);
  });

  test("missing name and bad email report per field", () => {
    let { type } = makeHost("fields");
    try {
      bookSlot({ ...guest(type.id, at("UTC", 2, "10:00")), guestName: " ", guestEmail: "nope" });
      assert(false, "should throw");
    } catch (err: any) {
      assert(err instanceof ValidationError, `got ${err}`);
      assert(err.errors?.guestName && err.errors?.guestEmail, `got ${JSON.stringify(err.errors)}`);
    }
  });
});

test("guest changes", () => {
  test("cancelling frees the slot", () => {
    let { type } = makeHost("gcancel");
    let startsAt = at("UTC", 2, "10:00");
    let { token } = bookSlot(guest(type.id, startsAt));
    assert(!slotsOn(type.id, "UTC", 2).some((d) => d.getTime() === startsAt.getTime()));

    guestCancel(token);
    equal(sql<{ status: string }>(`select status from bookings where token = ${token}`).firstOrThrow().status, "cancelled");
    assert(slotsOn(type.id, "UTC", 2).some((d) => d.getTime() === startsAt.getTime()), "slot is open again");
  });

  test("rescheduling moves the booking and bumps the sequence", () => {
    let { type } = makeHost("gmove");
    let { token } = bookSlot(guest(type.id, at("UTC", 2, "10:00")));
    let next = at("UTC", 3, "14:00");
    guestReschedule(token, next);

    let b = sql<{ startsAt: Date; endsAt: Date; sequence: number }>(`select * from bookings where token = ${token}`).firstOrThrow();
    equal(b.startsAt.getTime(), next.getTime());
    equal(b.endsAt.getTime() - b.startsAt.getTime(), 60 * 60_000);
    equal(b.sequence, 1);
  });

  test("a booking can move to a time next to where it was", () => {
    let { type } = makeHost("gnear");
    let { token } = bookSlot(guest(type.id, at("UTC", 2, "10:00")));
    // 11:00 is inside the old booking's buffer; only the booking itself blocks it.
    guestReschedule(token, at("UTC", 2, "11:00"));
    equal(fetchOpenSlots(type.id, token).some((d) => d.getTime() === at("UTC", 2, "10:00").getTime()), true);
  });
});

test("host changes", () => {
  test("a host can cancel and reschedule their own bookings", () => {
    let { host, type } = makeHost("hmine");
    let { token } = bookSlot(guest(type.id, at("UTC", 2, "10:00")));
    let id = sql<{ id: string }>(`select id from bookings where token = ${token}`).firstOrThrow().id;
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });

    hostReschedule(id, at("UTC", 2, "15:00"));
    equal(sql<{ startsAt: Date }>(`select startsAt from bookings where id = ${id}`).firstOrThrow().startsAt.getTime(), at("UTC", 2, "15:00").getTime());

    hostCancel(id);
    equal(sql<{ status: string }>(`select status from bookings where id = ${id}`).firstOrThrow().status, "cancelled");
  });

  test("a host cannot touch another host's booking", () => {
    let { type } = makeHost("theirs");
    let other = makeHost("intruder").host;
    let { token } = bookSlot(guest(type.id, at("UTC", 2, "10:00")));
    let id = sql<{ id: string }>(`select id from bookings where token = ${token}`).firstOrThrow().id;
    session.login({ userId: other.id, userName: "Intruder", userSlug: other.slug });

    let threw = false;
    try {
      hostCancel(id);
    } catch (err) {
      threw = true;
      assert(err instanceof ForbiddenError, `got ${err}`);
    }

    assert(threw);
  });
});
