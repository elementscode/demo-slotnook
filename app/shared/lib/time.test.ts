import { test, equal } from "@elements/app";
import { dayKey, formatTime, formatDuration } from "./time";

test("time", () => {
  test("one instant lands on different days in different zones", () => {
    let d = new Date("2026-10-01T02:30:00Z");
    equal(dayKey(d, "America/Los_Angeles"), "2026-09-30");
    equal(dayKey(d, "Asia/Tokyo"), "2026-10-01");
    equal(formatTime(d, "Europe/Berlin"), "4:30 AM");
  });

  test("durations", () => {
    equal(formatDuration(45), "45 min");
    equal(formatDuration(90), "1 hr 30 min");
    equal(formatDuration(120), "2 hr");
  });
});
