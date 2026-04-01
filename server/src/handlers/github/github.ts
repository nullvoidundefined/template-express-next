import type { Request, Response } from "express";

import { getGithubStatus } from "app/repositories/github/github.js";
import * as servicesRepo from "app/repositories/services/services.js";
import { parseIdParam } from "app/utils/parsers/parseIdParam.js";

export async function getGithubStatusHandler(req: Request, res: Response): Promise<void> {
  const id = parseIdParam(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: { message: "Invalid service ID" } });
    return;
  }
  const service = await servicesRepo.getServiceById(id);
  if (!service) {
    res.status(404).json({ error: { message: "Service not found" } });
    return;
  }
  const status = await getGithubStatus(id);
  res.json({ data: status });
}
