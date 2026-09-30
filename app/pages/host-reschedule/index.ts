import { Request, Response, sql, NotFoundError } from "@elements/app";
import { currentHost } from "#app/shared/services/host";
import { Booking, MeetingType, loadOpenSlots, slotChanges } from "#app/shared/services/scheduling";
import html from "./template";

export default function route(req: Request, res: Response) {
  let host = currentHost();
  if (!host) {
    return;
  }

  let booking = sql<Booking>(`
    select * from bookings where id = ${req.params.id}::uuid and userId = ${host.id} and status = 'confirmed'
  `).first();

  if (!booking) {
    throw new NotFoundError("booking not found");
  }

  let type = sql<MeetingType>(`select * from meetingTypes where id = ${booking.meetingTypeId}`).firstOrThrow("meeting type missing");

  let listener = slotChanges.listen({ filter: (c) => c.userId === host.id });
  let slots = loadOpenSlots(type.id, booking.id);

  return new html({ host, booking, type, slots, listener });
}
