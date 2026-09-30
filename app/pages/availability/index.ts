import { Request, Response } from "@elements/app";
import { currentHost } from "#app/shared/services/host";
import html, { loadWeek, loadOverrides } from "./template";

export default function route(req: Request, res: Response) {
  let host = currentHost();
  if (!host) {
    return;
  }

  return new html({ host, week: loadWeek(host.id), overrides: loadOverrides(host.id) });
}
