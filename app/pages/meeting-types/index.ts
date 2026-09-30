import { Request, Response } from "@elements/app";
import { currentHost } from "#app/shared/services/host";
import html, { loadMeetingTypes } from "./template";

export default function route(req: Request, res: Response) {
  let host = currentHost();
  if (!host) {
    return;
  }

  return new html({ host, types: loadMeetingTypes(host.id) });
}
