import { test, assert, equal, NotFoundError } from "@elements/app";
import { makeHost } from "#app/shared/lib/fixtures";
import { loadHostBySlug, loadMeetingType, loadOpenSlots } from "#app/shared/services/scheduling";

test("book page", () => {
  test("finds the host and type the url names, case-insensitively", () => {
    let { host, type } = makeHost("bp-host");
    let found = loadHostBySlug("BP-Host");
    equal(found.id, host.id);
    equal(loadMeetingType(found.id, "CALL").id, type.id);
    assert(loadOpenSlots(type.id).length > 0, "has open slots");
  });

  test("an unknown type is a 404", () => {
    let { host } = makeHost("bp-missing");
    let threw = false;
    try {
      loadMeetingType(host.id, "nope");
    } catch (err) {
      threw = true;
      assert(err instanceof NotFoundError, `got ${err}`);
    }

    assert(threw);
  });
});
