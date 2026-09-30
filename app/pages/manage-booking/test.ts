import { test, assert, equal, NotFoundError } from "@elements/app";
import { makeHost, at } from "#app/shared/lib/fixtures";
import { bookSlot, loadBookingByToken } from "#app/shared/services/scheduling";

test("manage booking page", () => {
  test("the emailed token finds the booking", () => {
    let { type } = makeHost("mb-host");
    let { token } = bookSlot({
      meetingTypeId: type.id,
      startsAt: at("UTC", 2, "10:00"),
      guestName: "Guest",
      guestEmail: "g@example.com",
      guestNote: "",
      guestTimeZone: "UTC",
    });

    equal(loadBookingByToken(token).guestName, "Guest");
    equal(token.length, 36);
  });

  test("a made-up token is a 404", () => {
    let threw = false;
    try {
      loadBookingByToken("not-a-real-token");
    } catch (err) {
      threw = true;
      assert(err instanceof NotFoundError, `got ${err}`);
    }

    assert(threw);
  });
});
