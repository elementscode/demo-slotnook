import { Request, Response, redirect, session, sql } from "@elements/app";
import html, { DemoLogin, DEMO_PASSWORD } from "./template";

export default function route(req: Request, res: Response) {
  if (session.isLoggedIn()) {
    redirect("/bookings");
    return;
  }

  // The demo hosts come from a development-only seed, so only development lists them.
  let demo = process.env.ENV === "development"
    ? sql<DemoLogin>(`
        select email as id, name, email, headline, timeZone from users
         where email like '%@slotnook.dev'
         order by name
      `).all()
    : [];

  return new html({ demo, password: DEMO_PASSWORD });
}
