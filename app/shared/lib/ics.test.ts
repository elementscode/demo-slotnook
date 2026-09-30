import { test, assert, equal } from "@elements/app";
import { buildIcs } from "./ics";

test("ics", () => {
  let base = {
    uid: "abc@slotnook",
    sequence: 2,
    method: "REQUEST" as const,
    startsAt: new Date("2026-10-01T16:00:00Z"),
    endsAt: new Date("2026-10-01T17:00:00Z"),
    summary: "Strategy session with Maya Chen",
    description: "Note: bring the deck, please; thanks",
    url: "http://localhost:4000/booking/t",
    organizerName: "Maya Chen",
    organizerEmail: "maya@slotnook.dev",
    attendeeName: "Priya Nair",
    attendeeEmail: "priya@example.com",
  };

  test("an invite carries UTC times, the sequence and escaped text", () => {
    let ics = buildIcs(base);
    assert(ics.includes("METHOD:REQUEST\r\n"), ics);
    assert(ics.includes("DTSTART:20261001T160000Z\r\n"), ics);
    assert(ics.includes("DTEND:20261001T170000Z\r\n"), ics);
    assert(ics.includes("SEQUENCE:2\r\n"), ics);
    assert(ics.includes("bring the deck\\, please\\; thanks"), ics);
    assert(ics.includes("STATUS:CONFIRMED"), ics);
  });

  test("a cancellation keeps the uid", () => {
    let ics = buildIcs({ ...base, method: "CANCEL" });
    assert(ics.includes("METHOD:CANCEL") && ics.includes("STATUS:CANCELLED") && ics.includes("UID:abc@slotnook"), ics);
  });

  test("long lines fold at 75 octets", () => {
    let ics = buildIcs({ ...base, description: "x".repeat(200) });
    for (let line of ics.split("\r\n")) {
      assert(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
    }

    equal(ics.split("\r\n").filter((l) => l.startsWith(" ")).length >= 2, true);
  });
});
