import { test, equal, session } from "@elements/app";
import { makeHost, at } from "#app/shared/lib/fixtures";
import { bookSlot } from "#app/shared/services/scheduling";
import { fetchMyBookings } from "./template";

test("bookings", () => {
  test("a host sees only their own bookings, in time order", () => {
    let mine = makeHost("bk-mine");
    let theirs = makeHost("bk-theirs");
    let guest = { guestName: "Guest", guestEmail: "g@example.com", guestNote: "", guestTimeZone: "UTC" };
    bookSlot({ ...guest, meetingTypeId: mine.type.id, startsAt: at("UTC", 3, "10:00") });
    bookSlot({ ...guest, meetingTypeId: mine.type.id, startsAt: at("UTC", 2, "14:00") });
    bookSlot({ ...guest, meetingTypeId: theirs.type.id, startsAt: at("UTC", 2, "10:00") });

    session.login({ userId: mine.host.id, userName: "Host", userSlug: mine.host.slug });
    let list = fetchMyBookings();
    equal(list.length, 2);
    equal(list[0].startsAt.getTime(), at("UTC", 2, "14:00").getTime());
    equal(list[0].meetingName, "Call");
  });
});
