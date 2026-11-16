import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = spawn(process.execPath, ["dist/main.js"], {
  cwd: path.join(root, "back-end"),
  stdio: "inherit",
  env: { ...process.env },
});
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => p.kill(s));
p.on("exit", (code) => {
  process.exitCode = code || 0;
});
