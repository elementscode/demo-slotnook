import { redirect, session, sql } from "@elements/app";
import { Host } from "#app/shared/services/scheduling";

/** The signed-in host, or a redirect to sign in. Call from a host page's route. */
export function currentHost(): Host | undefined {
  let userId = session.get("userId");
  let host = userId
    ? sql<Host>(`select id, name, slug, headline, timeZone from users where id = ${userId}`).first()
    : undefined;

  if (!host) {
    redirect("/signin");
    return undefined;
  }

  return host;
}
