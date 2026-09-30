import { Request, Response, sql } from "@elements/app";
import { loadHostBySlug, MeetingType } from "#app/shared/services/scheduling";
import html from "./template";

export default function route(req: Request, res: Response) {
  let host = loadHostBySlug(req.params.host);
  let types = sql<MeetingType>(`
    select * from meetingTypes where userId = ${host.id} and active order by durationMinutes, name
  `).all();

  return new html({ host, types });
}
