import fs from "fs/promises";
import path from "path";

import { chromium } from "playwright";

import { logger } from "app/utils/logs/logger.js";

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR ?? path.join(process.cwd(), "screenshots");
const VIEWPORT = { width: 1280, height: 800 };
const MAX_SCREENSHOTS_PER_SERVICE = 50;

export async function captureScreenshot(serviceId: string, url: string): Promise<string | null> {
  let browser;
  try {
    await fs.mkdir(path.join(SCREENSHOTS_DIR, serviceId), { recursive: true });

    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setViewportSize(VIEWPORT);

    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });

    const filename = `${Date.now()}.webp`;
    const filepath = path.join(SCREENSHOTS_DIR, serviceId, filename);
    await page.screenshot({ path: filepath, type: "jpeg" });

    return filepath;
  } catch (err) {
    logger.error({ err, serviceId, url }, "screenshot capture failed");
    return null;
  } finally {
    await browser?.close();
  }
}

export async function pruneScreenshots(serviceId: string): Promise<void> {
  // Keep only the last MAX_SCREENSHOTS_PER_SERVICE screenshots
  try {
    const dir = path.join(SCREENSHOTS_DIR, serviceId);
    const files = await fs.readdir(dir);
    const webps = files.filter((f) => f.endsWith(".webp")).sort(); // oldest first (timestamp filenames)
    const toDelete = webps.slice(0, Math.max(0, webps.length - MAX_SCREENSHOTS_PER_SERVICE));
    await Promise.all(toDelete.map((f) => fs.unlink(path.join(dir, f))));
  } catch {
    // Directory may not exist yet
  }
}

export function getLatestScreenshotPath(serviceId: string): Promise<string | null> {
  // Returns the path to the most recent screenshot, or null
  const dir = path.join(SCREENSHOTS_DIR, serviceId);
  return fs
    .readdir(dir)
    .then((files) => {
      const webps = files.filter((f) => f.endsWith(".webp")).sort();
      const last = webps[webps.length - 1];
      return last !== undefined ? path.join(dir, last) : null;
    })
    .catch(() => null);
}
