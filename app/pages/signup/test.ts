import { test, equal, session } from "@elements/app";
import { signup } from "#app/shared/services/auth";

test("signup page", () => {
  test("a new host lands signed in with their own page", () => {
    signup({ name: "Signup Page", email: "page@example.com", password: "password123", timeZone: "Asia/Kolkata" });
    equal(session.get("userSlug"), "signup-page");
  });
});
