import { test, assert, equal, sql, session, AuthError, ValidationError } from "@elements/app";
import { signin, signup, slugify } from "./auth";

test("auth", () => {
  test("slugify", () => {
    equal(slugify("Tomás Ferreira"), "tomas-ferreira");
    equal(slugify("  Growth & Pricing!  "), "growth-pricing");
  });

  test("signup creates a host with a starter meeting type and weekday hours", () => {
    signup({ name: "Ada Lovelace", email: " Ada@Example.com ", password: "difference-engine", timeZone: "Europe/London" });
    assert(session.isLoggedIn());

    let user = sql<{ id: string; email: string; slug: string; timeZone: string }>(`select * from users where email = 'ada@example.com'`).firstOrThrow();
    equal(user.slug, "ada-lovelace");
    equal(user.timeZone, "Europe/London");
    equal(sql<{ n: number }>(`select count(*)::int as n from meetingTypes where userId = ${user.id}`).firstOrThrow().n, 1);
    equal(sql<{ n: number }>(`select count(*)::int as n from availabilityRules where userId = ${user.id}`).firstOrThrow().n, 5);
  });

  test("signup gives a second host with the same name a unique link", () => {
    signup({ name: "Sam Lee", email: "sam1@example.com", password: "password123", timeZone: "UTC" });
    signup({ name: "Sam Lee", email: "sam2@example.com", password: "password123", timeZone: "UTC" });
    equal(sql<{ slug: string }>(`select slug from users where email = 'sam2@example.com'`).firstOrThrow().slug, "sam-lee-2");
  });

  test("signup rejects a short password and an unknown zone falls back to UTC", () => {
    try {
      signup({ name: "X", email: "x@example.com", password: "short", timeZone: "Mars/Olympus" });
      assert(false, "should throw");
    } catch (err: any) {
      assert(err instanceof ValidationError && err.errors?.password, `got ${err}`);
    }
  });

  test("signin checks the password", () => {
    signup({ name: "Pat", email: "pat@example.com", password: "correct-horse", timeZone: "UTC" });
    session.logout();

    let threw = false;
    try {
      signin("pat@example.com", "wrong-horse");
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw);

    signin("PAT@example.com", "correct-horse");
    equal(session.get("userSlug"), "pat");
  });
});
