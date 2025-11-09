#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const process = require("process");

const CONFIG_PATH =
  process.env.AUTO_JOB_CONFIG ?? path.join(process.cwd(), "auto-jobs.json");

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse config:", error);
    process.exit(1);
  }
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Login failed (${response.status}): ${body}`);
  }
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Login succeeded but no cookie was returned.");
  }
  return setCookie;
}

async function createSession(baseUrl, cookie, payload) {
  const response = await fetch(`${baseUrl}/api/test-sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Create session failed (${response.status}): ${body}`);
  }

  return response.json();
}

function log(message, extra = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      message,
      ...extra,
    })
  );
}

async function runJob(job, ctx) {
  const payload = {
    userType: job.payload.userType,
    category: job.payload.category,
    difficulty: job.payload.difficulty,
    count: job.payload.count,
  };
  if (typeof job.payload.customDurationSeconds === "number") {
    payload.customDurationSeconds = job.payload.customDurationSeconds;
  }

  let attempt = 0;
  while (attempt < 2) {
    attempt += 1;
    try {
      log("Running auto job", { label: job.label, attempt });
      const result = await createSession(ctx.baseUrl, ctx.cookie, payload);
      log("Auto job success", {
        label: job.label,
        sessionId: result.sessionId,
      });
      return;
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_EXPIRED" && attempt === 1) {
        log("Session expired, re-authenticating...", { label: job.label });
        ctx.cookie = await login(ctx.baseUrl, ctx.email, ctx.password);
        continue;
      }
      log("Auto job failed", { label: job.label, error: String(error) });
      return;
    }
  }
}

async function main() {
  const config = readConfig();
  if (!config.enabled) {
    console.log("Auto generator disabled in config.");
    return;
  }

  const baseUrl = (config.baseUrl ?? "http://localhost:3000").replace(/\/+$/, "");
  const email = config.email;
  const password = config.password;
  if (!email || !password) {
    console.error("Config must include email and password.");
    process.exit(1);
  }

  const jobs = (config.jobs ?? []).filter((job) => job.enabled);
  if (!jobs.length) {
    console.log("No enabled jobs found.");
    return;
  }

  const ctx = {
    baseUrl,
    email,
    password,
    cookie: await login(baseUrl, email, password),
  };

  const runOnce = process.argv.includes("--once");

  if (runOnce) {
    for (const job of jobs) {
      // eslint-disable-next-line no-await-in-loop
      await runJob(job, ctx);
    }
    return;
  }

  const timers = jobs.map((job) => {
    const intervalMs = Math.max(1, job.intervalMinutes ?? 60) * 60 * 1000;
    if (job.runOnStart !== false) {
      runJob(job, ctx).catch((error) =>
        log("Initial run error", { label: job.label, error: String(error) })
      );
    }
    return setInterval(() => {
      runJob(job, ctx).catch((error) =>
        log("Scheduled run error", { label: job.label, error: String(error) })
      );
    }, intervalMs);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down auto generator...");
    timers.forEach((timer) => clearInterval(timer));
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Auto generator crashed:", error);
  process.exit(1);
});
