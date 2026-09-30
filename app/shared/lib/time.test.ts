import { test, equal } from "@elements/app";
import { dayKey, formatTime, monthGrid, addMonths, formatDuration } from "./time";

test("time", () => {
  test("one instant lands on different days in different zones", () => {
    let d = new Date("2026-10-01T02:30:00Z");
    equal(dayKey(d, "America/Los_Angeles"), "2026-09-30");
    equal(dayKey(d, "Asia/Tokyo"), "2026-10-01");
    equal(formatTime(d, "Europe/Berlin"), "4:30 AM");
  });

  test("month grid starts on Sunday and pads to whole weeks", () => {
    let weeks = monthGrid("2026-10");
    equal(weeks.length, 5);
    equal(weeks[0].days.map((c) => c.day), ["", "", "", "", "2026-10-01", "2026-10-02", "2026-10-03"]);
    equal(weeks[4].days[6].day, "2026-10-31");
  });

  test("months roll over the year", () => {
    equal(addMonths("2026-12", 1), "2027-01");
    equal(addMonths("2026-01", -1), "2025-12");
  });

  test("durations", () => {
    equal(formatDuration(45), "45 min");
    equal(formatDuration(90), "1 hr 30 min");
    equal(formatDuration(120), "2 hr");
  });
});
