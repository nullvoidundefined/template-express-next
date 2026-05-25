import { redis } from 'app/services/redis.js';
import { logger } from 'app/utils/logs/logger.js';

const CIRCUIT_STATE_KEY = 'circuit:external:state';

async function isCircuitOpen(): Promise<boolean> {
  if (!redis) return false;
  try {
    const state = await redis.get(CIRCUIT_STATE_KEY);
    return state === 'open';
  } catch {
    return false;
  }
}

async function tripCircuit(): Promise<void> {
  if (!redis) return;
  try {
    const current = await redis.get(CIRCUIT_STATE_KEY);
    if (current === 'open') return;
    await redis.set(CIRCUIT_STATE_KEY, 'open', 'EX', 300);
    logger.warn({ event: 'circuit_tripped' }, 'Circuit breaker opened');
  } catch (err) {
    logger.error({ err }, 'Failed to trip circuit breaker');
  }
}

async function closeCircuit(): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(CIRCUIT_STATE_KEY, 'closed');
    logger.warn({ event: 'circuit_closed' }, 'Circuit breaker closed');
  } catch (err) {
    logger.error({ err }, 'Failed to close circuit breaker');
  }
}

export { closeCircuit, isCircuitOpen, tripCircuit };
