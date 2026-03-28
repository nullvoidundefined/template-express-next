import fs from "fs/promises";

import { chromium } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock playwright
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
  },
  mkdir: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
}));

// Mock logger
vi.mock("app/utils/logs/logger.js", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  captureScreenshot,
  getLatestScreenshotPath,
  pruneScreenshots,
} from "app/services/screenshotCapture.js";

const mockedChromium = vi.mocked(chromium);
const mockedFs = vi.mocked(fs);

describe("captureScreenshot", () => {
  const SERVICE_ID = "abc-123";
  const URL = "https://example.com";

  let mockBrowser: {
    newPage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let mockPage: {
    setViewportSize: ReturnType<typeof vi.fn>;
    goto: ReturnType<typeof vi.fn>;
    screenshot: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPage = {
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(undefined),
    };
    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockedChromium.launch.mockResolvedValue(mockBrowser as never);
    mockedFs.mkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a filepath on success", async () => {
    const result = await captureScreenshot(SERVICE_ID, URL);
    expect(result).not.toBeNull();
    expect(result).toMatch(/\.webp$/);
    expect(result).toContain(SERVICE_ID);
  });

  it("calls chromium.launch with sandbox args", async () => {
    await captureScreenshot(SERVICE_ID, URL);
    expect(mockedChromium.launch).toHaveBeenCalledWith({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  it("sets viewport to 1280x800", async () => {
    await captureScreenshot(SERVICE_ID, URL);
    expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 1280, height: 800 });
  });

  it("navigates to URL with networkidle and 15s timeout", async () => {
    await captureScreenshot(SERVICE_ID, URL);
    expect(mockPage.goto).toHaveBeenCalledWith(URL, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
  });

  it("takes a webp screenshot", async () => {
    await captureScreenshot(SERVICE_ID, URL);
    expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({ type: "webp" }));
  });

  it("closes the browser even on error", async () => {
    mockPage.goto.mockRejectedValue(new Error("Navigation failed"));
    const result = await captureScreenshot(SERVICE_ID, URL);
    expect(result).toBeNull();
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("returns null when browser launch fails", async () => {
    mockedChromium.launch.mockRejectedValue(new Error("Browser not installed"));
    const result = await captureScreenshot(SERVICE_ID, URL);
    expect(result).toBeNull();
  });

  it("returns null when screenshot fails", async () => {
    mockPage.screenshot.mockRejectedValue(new Error("Screenshot error"));
    const result = await captureScreenshot(SERVICE_ID, URL);
    expect(result).toBeNull();
  });
});

describe("pruneScreenshots", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deletes oldest files when over limit (50)", async () => {
    // 52 webp files — oldest 2 should be deleted
    const files = Array.from({ length: 52 }, (_, i) => `${String(i + 1).padStart(13, "0")}.webp`);
    mockedFs.readdir.mockResolvedValue(files as never);
    mockedFs.unlink.mockResolvedValue(undefined);

    await pruneScreenshots("service-1");

    expect(mockedFs.unlink).toHaveBeenCalledTimes(2);
    // The two oldest (smallest timestamps) should be deleted
    expect(mockedFs.unlink).toHaveBeenCalledWith(expect.stringContaining(files[0]!));
    expect(mockedFs.unlink).toHaveBeenCalledWith(expect.stringContaining(files[1]!));
  });

  it("does not delete when under limit", async () => {
    const files = Array.from({ length: 30 }, (_, i) => `${i}.webp`);
    mockedFs.readdir.mockResolvedValue(files as never);

    await pruneScreenshots("service-1");

    expect(mockedFs.unlink).not.toHaveBeenCalled();
  });

  it("does not delete when exactly at limit", async () => {
    const files = Array.from({ length: 50 }, (_, i) => `${i}.webp`);
    mockedFs.readdir.mockResolvedValue(files as never);

    await pruneScreenshots("service-1");

    expect(mockedFs.unlink).not.toHaveBeenCalled();
  });

  it("ignores non-webp files", async () => {
    const files = ["1.png", "2.jpg", "3.webp"] as never;
    mockedFs.readdir.mockResolvedValue(files);

    await pruneScreenshots("service-1");

    // Only 1 webp, well under limit — no deletions
    expect(mockedFs.unlink).not.toHaveBeenCalled();
  });

  it("silently handles missing directory", async () => {
    mockedFs.readdir.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    await expect(pruneScreenshots("missing-service")).resolves.toBeUndefined();
  });
});

describe("getLatestScreenshotPath", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns path to newest webp file", async () => {
    const files = ["1000000000000.webp", "1000000000001.webp", "1000000000002.webp"] as never;
    mockedFs.readdir.mockResolvedValue(files);

    const result = await getLatestScreenshotPath("service-1");

    expect(result).not.toBeNull();
    expect(result).toContain("1000000000002.webp");
  });

  it("returns null when directory is empty", async () => {
    mockedFs.readdir.mockResolvedValue([] as never);
    const result = await getLatestScreenshotPath("service-1");
    expect(result).toBeNull();
  });

  it("returns null when directory does not exist", async () => {
    mockedFs.readdir.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const result = await getLatestScreenshotPath("service-1");
    expect(result).toBeNull();
  });

  it("ignores non-webp files when selecting latest", async () => {
    const files = ["1000000000001.webp", "1000000000003.png", "1000000000002.jpg"] as never;
    mockedFs.readdir.mockResolvedValue(files);

    const result = await getLatestScreenshotPath("service-1");
    expect(result).toContain("1000000000001.webp");
  });
});
