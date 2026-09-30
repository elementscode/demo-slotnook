import { test, assert } from "@elements/app";
import route from "./index";

test("home", () => {
  test("is a redirect route with no page of its own", () => {
    assert(typeof route === "function");
  });
});
