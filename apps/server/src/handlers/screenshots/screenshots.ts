import { getLatestScreenshotPath } from 'app/services/screenshotCapture.js';
import { parseIdParam } from 'app/utils/parsers/parseIdParam.js';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';

export async function getScreenshotHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params['id'] ?? req.params['serviceId']);
    if (!id) {
      res.status(400).json({ error: { message: 'Invalid service ID' } });
      return;
    }

    const screenshotPath = await getLatestScreenshotPath(id);
    if (!screenshotPath) {
      res.status(404).json({ error: { message: 'No screenshot available' } });
      return;
    }

    const stat = fs.statSync(screenshotPath);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=300',
    );
    res.sendFile(screenshotPath);
  } catch (err) {
    next(err);
  }
}
