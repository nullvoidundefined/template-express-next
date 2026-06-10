import { isProd, isTest } from 'app/config/envConfig.js';
import pino from 'pino';

export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  // base structured JSON logs in all environments
  ...(isProd || isTest
    ? {}
    : {
        // pretty-print only in development
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});
