import { Request, Response, redirect, session, sql } from "@elements/app";
import html, { DemoLogin, DEMO_PASSWORD } from "./template";

export default function route(req: Request, res: Response) {
  if (session.isLoggedIn()) {
    redirect("/bookings");
    return;
  }

  // The seeded hosts, so a visitor can sign in without signing up.
  let demo = sql<DemoLogin>(`
    select email as id, name, email, headline, timeZone from users
     where email like '%@slotnook.dev'
     order by name
  `).all();

  return new html({ demo, password: DEMO_PASSWORD });
}
