import * as servicesRepo from 'app/repositories/services/services.js';
import {
  CreateServiceSchema,
  UpdateServiceSchema,
} from 'app/schemas/services.js';
import { parseIdParam } from 'app/utils/parsers/parseIdParam.js';
import type { Request, Response } from 'express';

export async function listServices(
  _req: Request,
  res: Response,
): Promise<void> {
  const services = await servicesRepo.listServices();
  res.json({ data: services });
}

export async function getService(req: Request, res: Response): Promise<void> {
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
  res.json({ data: service });
}

export async function createService(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = CreateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const service = await servicesRepo.createService(parsed.data);
  res.status(201).json({ data: service });
}

export async function updateService(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseIdParam(req.params['id']);
  if (!id) {
    res.status(400).json({ error: { message: 'Invalid service ID' } });
    return;
  }
  const parsed = UpdateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }
  const service = await servicesRepo.updateService(id, parsed.data);
  if (!service) {
    res.status(404).json({ error: { message: 'Service not found' } });
    return;
  }
  res.json({ data: service });
}

export async function deleteService(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseIdParam(req.params['id']);
  if (!id) {
    res.status(400).json({ error: { message: 'Invalid service ID' } });
    return;
  }
  const deleted = await servicesRepo.deleteService(id);
  if (!deleted) {
    res.status(404).json({ error: { message: 'Service not found' } });
    return;
  }
  res.status(204).send();
}
