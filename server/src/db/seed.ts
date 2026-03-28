import "dotenv/config";

import { query } from "app/db/pool/pool.js";
import { logger } from "app/utils/logs/logger.js";

const services = [
  {
    name: "Portfolio API",
    url: "https://api.example.com",
    health_endpoint: "https://api.example.com/health",
    github_owner: "iangreenough",
    github_repo: "portfolio-api",
    github_branch: "main",
    check_interval_seconds: 60,
    timeout_ms: 10000,
    expected_status_code: 200,
    screenshot_enabled: false,
    tags: ["api", "portfolio"],
  },
  {
    name: "Portfolio Web",
    url: "https://www.example.com",
    health_endpoint: null,
    github_owner: "iangreenough",
    github_repo: "portfolio-web",
    github_branch: "main",
    check_interval_seconds: 120,
    timeout_ms: 15000,
    expected_status_code: 200,
    screenshot_enabled: true,
    tags: ["web", "portfolio"],
  },
  {
    name: "Status Page",
    url: "https://status.example.com",
    health_endpoint: "https://status.example.com/health",
    github_owner: null,
    github_repo: null,
    github_branch: "main",
    check_interval_seconds: 30,
    timeout_ms: 5000,
    expected_status_code: 200,
    screenshot_enabled: true,
    tags: ["status", "internal"],
  },
];

async function seed() {
  logger.info("Seeding services...");
  for (const service of services) {
    await query(
      `INSERT INTO services
        (name, url, health_endpoint, github_owner, github_repo, github_branch,
         check_interval_seconds, timeout_ms, expected_status_code, screenshot_enabled, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT DO NOTHING`,
      [
        service.name,
        service.url,
        service.health_endpoint,
        service.github_owner,
        service.github_repo,
        service.github_branch,
        service.check_interval_seconds,
        service.timeout_ms,
        service.expected_status_code,
        service.screenshot_enabled,
        service.tags,
      ],
    );
    logger.info({ name: service.name }, "Seeded service");
  }
  logger.info("Seeding complete");
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
