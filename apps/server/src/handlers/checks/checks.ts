import { healthCheckQueue } from 'app/queues/healthCheck.js';
import * as checksRepo from 'app/repositories/checks/checks.js';
import * as servicesRepo from 'app/repositories/services/services.js';
import { parseIdParam } from 'app/utils/parsers/parseIdParam.js';
import { parsePagination } from 'app/utils/parsers/parsePagination.js';
import type { Request, Response } from 'express';

export async function getLatestCheck(
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
  const check = await checksRepo.getLatestCheck(id);
  res.json({ data: check });
}

export async function getCheckHistory(
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
  const { limit, offset } = parsePagination(
    req.query['limit'],
    req.query['offset'],
  );
  const checks = await checksRepo.getCheckHistory(id, limit, offset);
  res.json({ data: checks, meta: { limit, offset } });
}

export async function triggerCheck(req: Request, res: Response): Promise<void> {
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
  await healthCheckQueue.add('health-check', { serviceId: id }, { delay: 0 });
  res.status(202).json({ data: { message: 'Check scheduled' } });
}
