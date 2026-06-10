import { logger } from 'app/services/loggerService.js';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';

export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const header = req.headers['x-request-id'];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    const raw = fromHeader || randomUUID();
    const id = typeof raw === 'string' ? raw.slice(0, 64) : randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  serializers: {
    req(req: IncomingMessage & { id?: string }) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
    },
    res(res: ServerResponse) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
