import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npm, ["run", "start:dev"], {
    cwd: path.join(root, "back-end"),
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
  spawn(npm, ["run", "dev"], {
    cwd: path.join(root, "frontend"),
    stdio: "inherit",
    shell: process.platform === "win32",
  }),
];
let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  children.forEach((p) => p.kill());
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
for (const p of children)
  p.on("exit", (code) => {
    close();
    process.exitCode = code || 0;
  });
