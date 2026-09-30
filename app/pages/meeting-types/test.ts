import { test, assert, equal, session, ValidationError } from "@elements/app";
import { makeHost } from "#app/shared/lib/fixtures";
import { saveMeetingType } from "./template";

test("meeting types", () => {
  let form = { id: "", name: "Deep Dive", slug: "", description: " Two hours ", duration: "120", buffer: "30", active: true };

  test("creates a type with a slug from its name", () => {
    let { host } = makeHost("mt-create");
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });
    let types = saveMeetingType(form);
    let created = types.find((t) => t.slug === "deep-dive");
    assert(created, `got ${JSON.stringify(types)}`);
    equal(created?.durationMinutes, 120);
    equal(created?.description, "Two hours");
  });

  test("rejects a link the host already uses", () => {
    let { host } = makeHost("mt-clash");
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });
    try {
      saveMeetingType({ ...form, slug: "call" });
      assert(false, "should throw");
    } catch (err: any) {
      assert(err instanceof ValidationError && err.errors?.slug, `got ${err}`);
    }
  });

  test("hiding a type keeps it in the list", () => {
    let { host, type } = makeHost("mt-hide");
    session.login({ userId: host.id, userName: "Host", userSlug: host.slug });
    let types = saveMeetingType({ ...form, id: type.id, name: type.name, slug: type.slug, active: false });
    equal(types.find((t) => t.id === type.id)?.active, false);
  });
});
