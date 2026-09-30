import { test, assert } from "@elements/app";
import { Email } from "@elements/app";
import BookingUpdateEmail from "#app/emails/booking-update";

test("booking email", () => {
  let props = {
    heading: "You're booked",
    intro: "Hi Grace, your call is confirmed.",
    meetingName: "Intro call",
    hostName: "Maya Chen",
    when: "Thursday, October 1, 2026 · 10:00 AM – 10:15 AM",
    zone: "America / New York (EDT)",
    duration: "15 min",
    note: "About the launch",
    token: "tok123",
    bookAgainPath: "/maya/intro",
  };

  test("a live booking links to reschedule and cancel", () => {
    let e = new Email({ to: "grace@example.com", subject: "Confirmed", body: new BookingUpdateEmail(props) });
    assert(e.html.includes("/booking/tok123/reschedule"), e.html);
    assert(e.html.includes("/booking/tok123/cancel"), e.html);
    assert(e.text.includes("About the launch"), e.text);
    assert(!e.html.includes("Book another time"), e.html);
  });

  test("a cancelled booking offers to book again instead", () => {
    let e = new Email({ to: "grace@example.com", subject: "Cancelled", body: new BookingUpdateEmail({ ...props, cancelled: true }) });
    assert(!e.html.includes("/reschedule"), e.html);
    assert(e.html.includes("/maya/intro"), e.html);
  });
});
