import { afterEach, describe, expect, it, vi } from "vitest";

import { mockLogger } from "app/utils/tests/mockLogger.js";

describe("mockLogger", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes error, info, warn, and debug as mock functions", () => {
    expect(vi.isMockFunction(mockLogger.error)).toBe(true);
    expect(vi.isMockFunction(mockLogger.info)).toBe(true);
    expect(vi.isMockFunction(mockLogger.warn)).toBe(true);
    expect(vi.isMockFunction(mockLogger.debug)).toBe(true);
  });

  it("error can be called with arbitrary args and is tracked", () => {
    mockLogger.error("something broke");
    mockLogger.error({ err: new Error("oops") }, "context");

    expect(mockLogger.error).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenNthCalledWith(1, "something broke");
    expect(mockLogger.error).toHaveBeenNthCalledWith(2, { err: expect.any(Error) }, "context");
  });

  it("info can be called with arbitrary args and is tracked", () => {
    mockLogger.info("started");
    mockLogger.info({ port: 3000 }, "listening");

    expect(mockLogger.info).toHaveBeenCalledTimes(2);
    expect(mockLogger.info).toHaveBeenNthCalledWith(1, "started");
    expect(mockLogger.info).toHaveBeenNthCalledWith(2, { port: 3000 }, "listening");
  });

  it("warn can be called with arbitrary args and is tracked", () => {
    mockLogger.warn("deprecated");
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith("deprecated");
  });

  it("debug can be called with arbitrary args and is tracked", () => {
    mockLogger.debug("trace", { detail: 1 });
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith("trace", { detail: 1 });
  });
});
