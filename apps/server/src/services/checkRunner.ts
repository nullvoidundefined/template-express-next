import { redisConfig } from 'app/config/redis.js';
import { insertCheck } from 'app/repositories/checks/checks.js';
import type { CheckResult, CheckStatus } from 'app/schemas/checks.js';
import type { Service } from 'app/schemas/services.js';
import { handleIncidentLogic } from 'app/services/incidentManager.js';
import { dispatch } from 'app/services/notifications/dispatcher.js';
import {
  captureScreenshot,
  pruneScreenshots,
} from 'app/services/screenshotCapture.js';
import { logger } from 'app/utils/logs/logger.js';
import { Redis as IORedis } from 'ioredis';
import dns from 'node:dns';
import tls from 'node:tls';

const TLS_WARNING_DAYS = 14;
const TLS_URGENT_DAYS = 7;

const redis = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });

function parseTlsExpiresAt(certInfo: tls.PeerCertificate): Date | null {
  try {
    return new Date(certInfo.valid_to);
  } catch {
    return null;
  }
}

async function checkTls(
  hostname: string,
  port: number,
): Promise<{ valid: boolean; expiresAt: Date | null }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const expiresAt = cert ? parseTlsExpiresAt(cert) : null;
        const now = new Date();
        const valid = expiresAt !== null && expiresAt > now;
        socket.destroy();
        resolve({ valid, expiresAt });
      },
    );
    socket.on('error', () => {
      socket.destroy();
      resolve({ valid: false, expiresAt: null });
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve({ valid: false, expiresAt: null });
    });
  });
}

function determineStatus(opts: {
  statusCodeMatches: boolean;
  responseTimeMs: number;
  timeoutMs: number;
  tlsValid: boolean | null;
  tlsExpiresAt: Date | null;
  isHttps: boolean;
}): CheckStatus {
  const {
    statusCodeMatches,
    responseTimeMs,
    timeoutMs,
    tlsValid,
    tlsExpiresAt,
    isHttps,
  } = opts;

  if (!statusCodeMatches) return 'down';

  // Check TLS expiry
  if (isHttps && tlsExpiresAt !== null) {
    if (!tlsValid) return 'down';
    const daysUntilExpiry =
      (tlsExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilExpiry < TLS_WARNING_DAYS) return 'degraded';
  }

  if (responseTimeMs > timeoutMs * 0.8) return 'degraded';

  return 'up';
}

async function maybeSendTlsWarning(
  service: Service,
  tlsExpiresAt: Date | null,
): Promise<void> {
  if (!tlsExpiresAt) return;

  const daysUntilExpiry =
    (tlsExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry > TLS_WARNING_DAYS) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const warnKey = `tls_warned:${service.id}:${today}`;
  const alreadyWarned = await redis.get(warnKey);
  if (alreadyWarned) return;

  const days = Math.ceil(daysUntilExpiry);
  const event = {
    type: 'tls_warning' as const,
    serviceId: service.id,
    serviceName: service.name,
    daysUntilExpiry: days,
  };

  if (daysUntilExpiry <= TLS_URGENT_DAYS) {
    // Within 7 days: dispatch to all channels (SMS + email + slack)
    await dispatch(event).catch((err) =>
      logger.error(
        { err, serviceId: service.id },
        'Failed to dispatch urgent TLS warning',
      ),
    );
  } else {
    // Within 14 days but > 7 days: email only
    const { sendEmail } = await import('app/services/notifications/resend.js');
    await sendEmail(event).catch((err) =>
      logger.error(
        { err, serviceId: service.id },
        'Failed to send TLS warning email',
      ),
    );
  }

  // Deduplicate: one warning per service per day (expire after 25 hours)
  await redis.set(warnKey, '1', 'EX', 90000);
}

export async function runCheck(service: Service): Promise<CheckResult> {
  const targetUrl = service.health_endpoint ?? service.url;
  let hostname: string;
  let port: number;
  let isHttps: boolean;

  try {
    const parsed = new URL(targetUrl);
    hostname = parsed.hostname;
    isHttps = parsed.protocol === 'https:';
    port = parsed.port ? parseInt(parsed.port, 10) : isHttps ? 443 : 80;
  } catch {
    const result: CheckResult = {
      status: 'down',
      status_code: null,
      response_time_ms: null,
      dns_time_ms: null,
      tls_valid: null,
      tls_expires_at: null,
      error_message: 'Invalid URL',
    };
    await insertCheck({ service_id: service.id, ...result }).catch(
      (err: unknown) =>
        logger.error({ err, serviceId: service.id }, 'Failed to persist check'),
    );
    await handleIncidentLogic(service, result).catch((err: unknown) =>
      logger.error(
        { err, serviceId: service.id },
        'Failed to handle incident logic',
      ),
    );
    return result;
  }

  // DNS resolution
  let dns_time_ms: number | null = null;
  try {
    const dnsStart = Date.now();
    await dns.promises.lookup(hostname);
    dns_time_ms = Date.now() - dnsStart;
  } catch (err) {
    const result: CheckResult = {
      status: 'down',
      status_code: null,
      response_time_ms: null,
      dns_time_ms: null,
      tls_valid: null,
      tls_expires_at: null,
      error_message: `DNS resolution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
    await insertCheck({ service_id: service.id, ...result }).catch(
      (insertErr: unknown) =>
        logger.error(
          { err: insertErr, serviceId: service.id },
          'Failed to persist check',
        ),
    );
    await handleIncidentLogic(service, result).catch((incidentErr: unknown) =>
      logger.error(
        { err: incidentErr, serviceId: service.id },
        'Failed to handle incident logic',
      ),
    );
    return result;
  }

  // TLS check (parallel with HTTP)
  const tlsPromise = isHttps
    ? checkTls(hostname, port)
    : Promise.resolve({ valid: null as null, expiresAt: null as null });

  // HTTP request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), service.timeout_ms);
  const requestStart = Date.now();

  let status_code: number | null = null;
  let response_time_ms: number | null = null;
  let error_message: string | null = null;
  let statusCodeMatches = false;

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
    });
    response_time_ms = Date.now() - requestStart;
    status_code = response.status;
    statusCodeMatches = status_code === service.expected_status_code;
  } catch (err) {
    response_time_ms = Date.now() - requestStart;
    if (err instanceof Error && err.name === 'AbortError') {
      error_message = `Request timed out after ${service.timeout_ms}ms`;
    } else {
      error_message = `Request failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const tlsResult = await tlsPromise;
  const tls_valid = isHttps ? tlsResult.valid : null;
  const tls_expires_at = isHttps ? tlsResult.expiresAt : null;

  let status: CheckStatus;
  if (!statusCodeMatches || error_message) {
    status = 'down';
  } else {
    status = determineStatus({
      statusCodeMatches,
      responseTimeMs: response_time_ms ?? 0,
      timeoutMs: service.timeout_ms,
      tlsValid: tls_valid,
      tlsExpiresAt: tls_expires_at,
      isHttps,
    });
  }

  const result: CheckResult = {
    status,
    status_code,
    response_time_ms,
    dns_time_ms,
    tls_valid,
    tls_expires_at,
    error_message,
  };

  let screenshot_path: string | null = null;
  if (service.screenshot_enabled) {
    screenshot_path = await captureScreenshot(service.id, service.url);
    if (screenshot_path) {
      await pruneScreenshots(service.id);
    }
  }

  await insertCheck({
    service_id: service.id,
    ...result,
    screenshot_path,
  }).catch((err: unknown) =>
    logger.error({ err, serviceId: service.id }, 'Failed to persist check'),
  );

  await handleIncidentLogic(service, result).catch((err: unknown) =>
    logger.error(
      { err, serviceId: service.id },
      'Failed to handle incident logic',
    ),
  );

  // TLS expiration warnings
  if (isHttps && tls_expires_at) {
    await maybeSendTlsWarning(service, tls_expires_at).catch((err: unknown) =>
      logger.error(
        { err, serviceId: service.id },
        'Failed to send TLS warning',
      ),
    );
  }

  return result;
}

export { determineStatus };
