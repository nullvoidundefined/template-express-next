import { vi } from "vitest";

/** Shared logger mock for handler tests. Use with vi.mock("app/utils/logs/logger.js", () => ({ logger: mockLogger })). */
export const mockLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};
