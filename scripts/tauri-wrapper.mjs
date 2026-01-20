import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const isDev = args[0] === "dev";
const hasConfig = args.includes("--config") || args.includes("-c");

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const projectRoot = path.resolve(scriptsDir, "..");

const python = process.env.VMARK_PYTHON ?? "python3";
const devIconsScript = path.join(projectRoot, "scripts", "generate-dev-icons.py");

// Use platform-specific tauri CLI path from node_modules
const isWindows = process.platform === "win32";
const tauriBin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  isWindows ? "tauri.cmd" : "tauri"
);

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: isWindows });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return typeof result.status === "number" ? result.status : 1;
};

if (isDev) {
  const status = run(python, [devIconsScript]);
  if (status !== 0) {
    process.exit(status);
  }
}

const tauriArgs = isDev && !hasConfig
  ? [...args, "--config", "src-tauri/tauri.dev.conf.json"]
  : args;

process.exit(run(tauriBin, tauriArgs));
