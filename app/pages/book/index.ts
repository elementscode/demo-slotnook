import { Request, Response } from "@elements/app";
import { loadHostBySlug, loadMeetingType, loadOpenSlots, slotChanges } from "#app/shared/services/scheduling";
import html from "./template";

export default function route(req: Request, res: Response) {
  let host = loadHostBySlug(req.params.host);
  let type = loadMeetingType(host.id, req.params.type);

  // Listen before reading the slots, so a booking made in between still arrives.
  let listener = slotChanges.listen({ filter: (c) => c.userId === host.id });
  let slots = loadOpenSlots(type.id);

  return new html({ host, type, slots, listener });
}
