import { Request, Response } from "@elements/app";
import { currentHost } from "#app/shared/services/host";
import { slotChanges } from "#app/shared/services/scheduling";
import html, { loadHostBookings } from "./template";

export default function route(req: Request, res: Response) {
  let host = currentHost();
  if (!host) {
    return;
  }

  let listener = slotChanges.listen({ filter: (c) => c.userId === host.id });
  let bookings = loadHostBookings(host.id);

  return new html({ host, bookings, listener });
}
