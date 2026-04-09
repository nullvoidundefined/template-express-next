import * as incidentsRepo from 'app/repositories/incidents/incidents.js';
import * as servicesRepo from 'app/repositories/services/services.js';
import {
  CreateIncidentSchema,
  UpdateIncidentSchema,
} from 'app/schemas/incidents.js';
import { parseIdParam } from 'app/utils/parsers/parseIdParam.js';
import type { Request, Response } from 'express';

export async function listIncidents(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseIdParam(req.params['id']);
  if (!id) {
    res.status(400).json({ error: { message: 'Invalid service ID' } });
    return;
  }
  const service = await servicesRepo.getServiceById(id);
  if (!service) {
    res.status(404).json({ error: { message: 'Service not found' } });
    return;
  }
  const incidents = await incidentsRepo.listIncidentsByService(id);
  res.json({ data: incidents });
}

export async function createIncident(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseIdParam(req.params['id']);
  if (!id) {
    res.status(400).json({ error: { message: 'Invalid service ID' } });
    return;
  }
  const service = await servicesRepo.getServiceById(id);
  if (!service) {
    res.status(404).json({ error: { message: 'Service not found' } });
    return;
  }
  const parsed = CreateIncidentSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const incident = await incidentsRepo.createIncident(id, parsed.data);
  res.status(201).json({ data: incident });
}

export async function updateIncidentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseIdParam(req.params['incidentId']);
  if (!id) {
    res.status(400).json({ error: { message: 'Invalid incident ID' } });
    return;
  }
  const existing = await incidentsRepo.getIncidentById(id);
  if (!existing) {
    res.status(404).json({ error: { message: 'Incident not found' } });
    return;
  }
  const parsed = UpdateIncidentSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const updated = await incidentsRepo.updateIncident(id, parsed.data);
  res.json({ data: updated });
}
