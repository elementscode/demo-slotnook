import { Request, Response, sql } from "@elements/app";
import {
  Host,
  MeetingType,
  loadBookingByToken,
  loadOpenSlots,
  slotChanges,
} from "#app/shared/services/scheduling";
import html, { Mode } from "./template";

export default function route(req: Request, res: Response) {
  let booking = loadBookingByToken(req.params.token);
  let host = sql<Host>(`select id, name, slug, headline, timeZone from users where id = ${booking.userId}`).firstOrThrow("host missing");
  let type = sql<MeetingType>(`select * from meetingTypes where id = ${booking.meetingTypeId}`).firstOrThrow("meeting type missing");

  let listener = slotChanges.listen({ filter: (c) => c.userId === host.id });
  let slots = loadOpenSlots(type.id, booking.id);

  let mode: Mode = req.params.action === "reschedule" || req.params.action === "cancel" ? req.params.action : "view";

  return new html({ booking, host, type, slots, listener, mode });
}
