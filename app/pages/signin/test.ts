import { test, equal, sql, session } from "@elements/app";
import { signin } from "#app/shared/services/auth";
import { DEMO_PASSWORD } from "./template";

test("signin page", () => {
  test("the demo password signs a demo host in", () => {
    sql(`
      insert into users (email, passwordHash, name, slug)
           values ('demo@slotnook.dev', crypt(${DEMO_PASSWORD}, genSalt('bf', 4)), 'Demo Host', 'demo')
    `);
    signin("demo@slotnook.dev", DEMO_PASSWORD);
    equal(session.get("userName"), "Demo Host");
  });
});
