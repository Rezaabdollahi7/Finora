/**
 * Sprint 0 foundation acceptance test (task 0.11).
 *
 * Checks the whole foundation against a running application rather than
 * against the source: Docker config, PostgreSQL, Prisma, React, routing, RTL,
 * theming, and a clean browser console.
 *
 *   npm run build && npm run start   # in one terminal
 *   npm run acceptance               # in another
 *
 * Environment:
 *   BASE_URL         defaults to http://localhost:3000
 *   CHROMIUM_PATH    override the browser binary (for preinstalled Chromium)
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { chromium } from "playwright";

const run = promisify(execFile);
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const ROUTES = [
  "/dashboard",
  "/accounts",
  "/transactions",
  "/assets",
  "/loans",
  "/budgets",
  "/goals",
  "/calendar",
  "/reports",
  "/settings",
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const results = [];

async function check(group, label, fn) {
  try {
    const note = await fn();
    results.push({ group, label, ok: true, note });
    console.log(`  ✓ ${label}${note ? ` — ${note}` : ""}`);
  } catch (error) {
    const message = String(error?.message ?? error).split("\n")[0];
    results.push({ group, label, ok: false, note: message });
    console.log(`  ✗ ${label} — ${message}`);
  }
}

function heading(text) {
  console.log(`\n${text}`);
}

/* ------------------------------------------------------------------ */
/* Docker                                                              */
/* ------------------------------------------------------------------ */
heading("Docker");

await check("docker", "development compose file is valid", async () => {
  await run("docker", ["compose", "config", "-q"]);
});

await check("docker", "production compose file is valid", async () => {
  await run("docker", ["compose", "-f", "docker-compose.prod.yml", "config", "-q"], {
    env: {
      ...process.env,
      POSTGRES_USER: process.env.POSTGRES_USER ?? "finora",
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? "finora",
      POSTGRES_DB: process.env.POSTGRES_DB ?? "finora",
    },
  });
});

/* ------------------------------------------------------------------ */
/* PostgreSQL and Prisma                                               */
/* ------------------------------------------------------------------ */
heading("PostgreSQL and Prisma");

await check("database", "no migration is pending against the database", async () => {
  // `migrate status` exits non-zero when the database is unreachable or the
  // applied migrations do not match prisma/migrations.
  const { stdout } = await run("npx", ["prisma", "migrate", "status"]);
  if (!/up to date/i.test(stdout)) throw new Error(stdout.trim().split("\n").pop());
  return "schema matches prisma/migrations";
});

await check("database", "Prisma connects and round-trips a row", async () => {
  // Run the integration test through Vitest rather than importing the client
  // here: src/lib/prisma.ts is TypeScript using the @/* alias, which plain
  // Node cannot resolve.
  await run("npx", ["vitest", "run", "src/lib/prisma.integration.test.ts"]);
  return "connect, write, read and unique constraint all verified";
});

/* ------------------------------------------------------------------ */
/* HTTP routing                                                        */
/* ------------------------------------------------------------------ */
heading("Routing");

await check("routing", "server is reachable", async () => {
  const response = await fetch(BASE_URL, { redirect: "manual" });
  if (response.status >= 500) throw new Error(`status ${response.status}`);
  return `${BASE_URL} responded ${response.status}`;
});

await check("routing", "/ redirects to /dashboard", async () => {
  const response = await fetch(BASE_URL, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  if (!location.endsWith("/dashboard")) {
    throw new Error(`redirected to "${location}"`);
  }
});

for (const route of ROUTES) {
  await check("routing", `${route} serves 200`, async () => {
    const response = await fetch(`${BASE_URL}${route}`);
    if (response.status !== 200) throw new Error(`status ${response.status}`);
  });
}

await check("routing", "an unknown path serves 404", async () => {
  const response = await fetch(`${BASE_URL}/definitely-not-a-route`);
  if (response.status !== 404) throw new Error(`status ${response.status}`);
});

/* ------------------------------------------------------------------ */
/* Browser                                                             */
/* ------------------------------------------------------------------ */
heading("React, RTL, theming and responsive layout");

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const consoleErrors = [];

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage({ viewport });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${name}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${name}: ${error.message}`));
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });

  await check(name, `[${name}] React hydrates and renders the page`, async () => {
    await page
      .getByRole("heading", { level: 1, name: "داشبورد" })
      .waitFor({ timeout: 5000 });
  });

  await check(name, `[${name}] document is RTL Persian in Dana`, async () => {
    const info = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      font: getComputedStyle(document.body).fontFamily,
      // next/font renames the family, so ask the font set what loaded.
      loaded: [...document.fonts].some(
        (face) => face.status === "loaded" && /dana/i.test(face.family),
      ),
    }));
    if (info.dir !== "rtl") throw new Error(`dir="${info.dir}"`);
    if (info.lang !== "fa") throw new Error(`lang="${info.lang}"`);
    if (!/dana/i.test(info.font) || !info.loaded) throw new Error(`font: ${info.font}`);
    return `dir=${info.dir} lang=${info.lang}`;
  });

  await check(name, `[${name}] no horizontal overflow`, async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) throw new Error(`${overflow}px of horizontal scroll`);
  });

  const isDesktop = name === "desktop";

  await check(name, `[${name}] navigation matches the breakpoint`, async () => {
    const sidebar = await page.locator("aside").isVisible();
    const tabBar = await page
      .getByRole("navigation", { name: "پیمایش سریع" })
      .isVisible();

    if (isDesktop && (!sidebar || tabBar)) {
      throw new Error(`sidebar=${sidebar} tabBar=${tabBar}`);
    }
    if (!isDesktop && (sidebar || !tabBar)) {
      throw new Error(`sidebar=${sidebar} tabBar=${tabBar}`);
    }
    return isDesktop ? "sidebar only" : "tab bar and drawer only";
  });

  if (isDesktop) {
    await check(
      name,
      `[${name}] sidebar sits on the inline start (right)`,
      async () => {
        const box = await page.locator("aside").boundingBox();
        const gap = viewport.width - (box.x + box.width);
        if (gap > 5) throw new Error(`${gap}px from the right edge`);
      },
    );

    await check(
      name,
      `[${name}] clicking a nav item routes and moves the active pill`,
      async () => {
        await page.getByRole("link", { name: "وام‌ها" }).first().click();
        await page.waitForURL("**/loans");
        const active = await page.locator('[aria-current="page"]').first().innerText();
        if (!active.includes("وام")) throw new Error(`active item: ${active}`);
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
      },
    );
  }

  await check(
    name,
    `[${name}] dark and light themes apply and survive navigation`,
    async () => {
      const backgroundOf = () =>
        page.evaluate(() => getComputedStyle(document.body).backgroundColor);

      await page.getByRole("button", { name: "تغییر پوسته" }).click();
      await page.getByRole("menuitem", { name: "تیره" }).click();
      await page.waitForTimeout(250);
      const dark = await backgroundOf();

      await page.goto(`${BASE_URL}/accounts`, { waitUntil: "networkidle" });
      if (
        !(await page.evaluate(() => document.documentElement.className)).includes(
          "dark",
        )
      ) {
        throw new Error("theme lost on navigation");
      }

      await page.getByRole("button", { name: "تغییر پوسته" }).click();
      await page.getByRole("menuitem", { name: "روشن" }).click();
      await page.waitForTimeout(250);
      const light = await backgroundOf();

      if (dark === light) throw new Error(`both themes painted ${light}`);
      return `dark ${dark} / light ${light}`;
    },
  );

  await page.close();
}

await browser.close();

await check("browser", "no console or page errors in any viewport", async () => {
  if (consoleErrors.length > 0) throw new Error(consoleErrors.join(" | "));
});

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */
const failed = results.filter((result) => !result.ok);

console.log(`\n${"-".repeat(60)}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);

if (failed.length > 0) {
  console.log("\nFailed:");
  for (const result of failed) console.log(`  - ${result.label}: ${result.note}`);
  process.exit(1);
}

console.log("Sprint 0 foundation acceptance: PASS");
