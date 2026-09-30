import { test, equal } from "@elements/app";
import { initials } from "./template";

test("host profile", () => {
  test("initials", () => {
    equal(initials("Maya Chen"), "MC");
    equal(initials("Jonas"), "J");
    equal(initials("Ana María de la Cruz"), "AM");
  });
});
