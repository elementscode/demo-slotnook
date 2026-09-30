import { test, assert, equal, sql, session, ValidationError } from "@elements/app";
import { makeHost, dateIn } from "#app/shared/lib/fixtures";
import { saveHours, saveOverride, removeOverride, loadWeek } from "./template";

test("availability", () => {
  test("saving hours replaces the week and the zone", () => {
    let { host } = makeHost("av-save");
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });

    let week = loadWeek(host.id).map((d) => ({
      ...d,
      on: d.weekday === 2,
      windows: d.weekday === 2 ? [{ id: "a", start: "08:00", end: "10:00" }, { id: "b", start: "13:00", end: "15:30" }] : [],
    }));
    saveHours("Europe/Paris", week);

    let reloaded = loadWeek(host.id);
    equal(reloaded.filter((d) => d.on).map((d) => d.label), ["Tuesday"]);
    equal(reloaded.find((d) => d.weekday === 2)?.windows.map((w) => `${w.start}-${w.end}`), ["08:00-10:00", "13:00-15:30"]);
    equal(sql<{ timeZone: string }>(`select timeZone from users where id = ${host.id}`).firstOrThrow().timeZone, "Europe/Paris");
  });

  test("overlapping hours are rejected", () => {
    let { host } = makeHost("av-overlap");
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });
    let week = loadWeek(host.id).map((d) => ({
      ...d,
      windows: [{ id: "a", start: "09:00", end: "12:00" }, { id: "b", start: "11:00", end: "13:00" }],
    }));

    let threw = false;
    try {
      saveHours("UTC", week);
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw);
  });

  test("an override replaces earlier ones for its date and can be removed", () => {
    let { host } = makeHost("av-override");
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });
    let date = dateIn("UTC", 5);

    saveOverride({ date, allDay: true, start: "", end: "" });
    let list = saveOverride({ date, allDay: false, start: "10:00", end: "12:00" });
    equal(list.map((o) => `${o.date} ${o.startTime}`), [`${date} 10:00:00`]);

    equal(removeOverride(date).length, 0);
  });
});
