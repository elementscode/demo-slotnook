import { test, assert, session } from "@elements/app";
import { makeHost, at } from "#app/shared/lib/fixtures";
import { bookSlot, fetchOpenSlots } from "#app/shared/services/scheduling";

test("host reschedule page", () => {
  test("the booking's own time stays offered while picking a new one", () => {
    let { host, type } = makeHost("hr-host");
    let startsAt = at("UTC", 2, "10:00");
    let { token } = bookSlot({ meetingTypeId: type.id, startsAt, guestName: "G", guestEmail: "g@example.com", guestNote: "", guestTimeZone: "UTC" });
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });

    assert(!fetchOpenSlots(type.id).some((d) => d.getTime() === startsAt.getTime()), "taken for everyone else");
    assert(fetchOpenSlots(type.id, token).some((d) => d.getTime() === startsAt.getTime()), "open to itself");
  });
});
