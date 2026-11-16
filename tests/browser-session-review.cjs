const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "indai-session-ui-"));
  const port = 34865;
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["dist/main.js"], {
    cwd: path.join(__dirname, "..", "back-end"),
    env: {
      ...process.env, PORT: String(port), DATA_DIR: dataDir, DEMO_MODE: "true",
      NODE_ENV: "test", OTP_DELIVERY_MODE: "demo", COOKIE_SECURE: "false",
      UPSTOX_ANALYTICS_TOKEN: "", RATE_LIMIT_SENSITIVE_MAX: "1000",
    },
    stdio: "ignore",
  });
  const browsers = [];
  const errors = [];
  async function login(email, password) {
    const browser = await chromium.launch({
      ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    browsers.push(browser);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#login-btn").click();
    await page.getByLabel("Enter OTP", { exact: true }).fill("123456");
    await page.getByRole("button", { name: "Verify & continue" }).click();
    await page.waitForURL("**/*dashboard");
    return page;
  }
  const indiaTime = (minutes) => new Date(Date.now() + (minutes + 330) * 60_000).toISOString();
  const button = (scope, name) => scope.getByRole("button", { name, exact: true });
  const card = (page, title) => page.locator(".card").filter({ has: page.getByText(title, { exact: true }) }).last();
  async function schedule(page, title, checkInvalidTime = false) {
    await button(page, "+ Add Session").click();
    const dialog = page.getByRole("dialog", { name: "Schedule Session" });
    await dialog.getByLabel("Title", { exact: true }).fill(title);
    await dialog.getByLabel("Instructor", { exact: true }).selectOption("u3");
    const dateField = dialog.getByLabel("Date (IST)", { exact: true });
    const timeField = dialog.getByLabel("Start time (IST)", { exact: true });
    if (checkInvalidTime) {
      // Bypass the native minimum to exercise the React rule independently.
      const tooSoon = indiaTime(15);
      await dateField.evaluate(input => input.removeAttribute("min"));
      await dateField.fill(tooSoon.slice(0, 10));
      await timeField.fill(tooSoon.slice(11, 16));
      await button(dialog, "Save").click();
      await dialog.getByRole("alert").getByText("Session must start at least one hour from now (IST).").waitFor();
    }
    const valid = indiaTime(180);
    await dateField.fill(valid.slice(0, 10));
    await timeField.fill(valid.slice(11, 16));
    await button(dialog, "Save").click();
    await dialog.waitFor({ state: "hidden" });
    await card(page, title).getByText("Awaiting instructor approval", { exact: false }).waitFor();
  }
  async function reject(page, dialogTitle, remark) {
    const dialog = page.getByRole("dialog", { name: dialogTitle });
    await dialog.getByLabel("Rejection remark").fill("   ");
    await button(dialog, "Confirm rejection").click();
    await dialog.getByRole("alert").waitFor();
    await dialog.getByLabel("Rejection remark").fill(remark);
    await button(dialog, "Confirm rejection").click();
    await dialog.waitFor({ state: "hidden" });
  }
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/public/config")).ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const admin = await login("superadmin@indai.com", "Admin@1234");
    const teacher = await login("instructor@indai.com", "Inst@1234");
    const learner = await login("learner@indai.com", "Learn@1234");
    await button(admin, "Sessions").click();
    await schedule(admin, "Browser session to accept", true);
    await schedule(admin, "Browser session to reject");
    await teacher.locator("#tab-assignments").click();
    await button(card(teacher, "Browser session to accept"), "Accept session").click();
    await button(card(teacher, "Browser session to reject"), "Reject session").click();
    await reject(teacher, "Reject session", "Schedule conflict in browser test.");
    await learner.locator("#tab-learning").click();
    await learner.getByText("Browser session to accept", { exact: true }).waitFor();
    assert.equal(await learner.getByText("Browser session to reject", { exact: true }).count(), 0);
    await button(teacher, "+ Create Assignment").click();
    const assignment = teacher.getByRole("dialog", { name: "Assignment" });
    await assignment.getByLabel("Title", { exact: true }).fill("Browser assignment review");
    await assignment.getByLabel("Description", { exact: true }).fill("Explain your virtual trade.");
    await assignment.getByLabel("Due date (IST)").fill(indiaTime(1440).slice(0, 10));
    await button(assignment, "Save").click();
    await assignment.waitFor({ state: "hidden" });
    await learner.locator("#tab-challenges").click();
    await button(card(learner, "Browser assignment review"), "Submit work").click();
    const work = learner.getByRole("dialog", { name: "Browser assignment review" });
    await work.getByLabel("Your solution").fill("This is my paper trade plan.");
    await button(work, "Save").click();
    await work.waitFor({ state: "hidden" });
    await teacher.reload();
    await teacher.locator("#tab-assignments").click();
    await button(card(teacher, "Browser assignment review"), "Reject submission").click();
    await reject(teacher, "Reject assignment submission", "Please include your risk limit.");
    await learner.reload();
    await learner.locator("#tab-challenges").click();
    await button(card(learner, "Browser assignment review"), "Resubmit work").waitFor();
    await button(admin, "Audit Log").click();
    await admin.getByLabel("Search activity").fill("assignment rejected");
    await button(admin, "Search").click();
    await admin.getByRole("row").filter({ hasText: "ASSIGNMENT REJECTED" })
      .getByText("Please include your risk limit.", { exact: false }).waitFor();
    await admin.getByLabel("Search activity").fill("session rejected");
    await button(admin, "Search").click();
    await admin.getByRole("row").filter({ hasText: "SESSION REJECTED" })
      .getByText("Schedule conflict in browser test.", { exact: false }).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS browser session scheduling, instructor decisions, assignment rejection, and Super Admin audit log");
  } finally {
    await Promise.all(browsers.map(browser => browser.close()));
    if (server.exitCode === null) await new Promise(resolve => {
      server.once("exit", resolve);
      server.kill();
    });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
