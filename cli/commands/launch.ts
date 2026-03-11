import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { OPENCLAW_HOME } from "../../shared/types.js";

export interface LaunchOptions {
  port?: number;
}

/**
 * Launches a new OpenClaw instance using a pulled brain.
 * Creates a temporary openclaw home with the brain's consciousness injected.
 */
export async function launchCommand(brainRef: string, opts: LaunchOptions): Promise<void> {
  console.log(chalk.blue("=== Brain Launch ==="));

  // Resolve brain directory
  const brainDir = resolveBrainDir(brainRef);
  if (!brainDir) return;

  console.log(chalk.gray(`Brain source: ${brainDir}`));

  // Check if openclaw is installed
  try {
    execSync("which openclaw", { stdio: "pipe" });
  } catch {
    console.log(chalk.red("OpenClaw CLI not found in PATH."));
    console.log(chalk.gray("Install OpenClaw first, or set OPENCLAW_HOME manually."));
    return;
  }

  // Create a new openclaw home by copying the template from the brain
  const launchDir = path.join(process.cwd(), "launched", path.basename(brainDir));
  if (fs.existsSync(launchDir)) {
    console.log(chalk.yellow(`Launch directory already exists: ${launchDir}`));
    console.log(chalk.gray("Remove it first or use a different brain ID."));
    return;
  }

  console.log(chalk.yellow("Setting up OpenClaw environment..."));
  fs.mkdirSync(launchDir, { recursive: true });

  // Copy brain files into openclaw-compatible structure
  copyBrainToOpenclawHome(brainDir, launchDir);

  console.log(chalk.green(`Environment created at: ${launchDir}`));
  console.log();
  console.log(chalk.blue("To start OpenClaw with this brain:"));
  console.log();
  console.log(chalk.white(`  OPENCLAW_HOME=${launchDir} openclaw`));
  console.log();
  console.log(chalk.gray("Or add to your shell:"));
  console.log(chalk.gray(`  export OPENCLAW_HOME=${launchDir}`));
  console.log(chalk.gray("  openclaw"));
}

function resolveBrainDir(ref: string): string | null {
  if (fs.existsSync(ref) && fs.statSync(ref).isDirectory()) return ref;
  const pulledDir = path.join(process.cwd(), "pulled", ref);
  if (fs.existsSync(pulledDir)) return pulledDir;
  console.log(chalk.red(`Cannot resolve brain: ${ref}`));
  console.log(chalk.gray("Pull the brain first: brain pull <brain-id>"));
  return null;
}

function copyBrainToOpenclawHome(brainDir: string, homeDir: string): void {
  // The brain package mirrors ~/.openclaw/ structure
  // Copy everything from the brain into the new home
  const entries = fs.readdirSync(brainDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "manifest.json") continue; // skip brain manifest

    const src = path.join(brainDir, entry.name);
    const dst = path.join(homeDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(src, dst);
    } else {
      fs.copyFileSync(src, dst);
    }
  }

  // Create empty directories that openclaw expects
  const requiredDirs = [
    "browser",
    "credentials",
    "identity",
    "agents/main/agent",
    "agents/main/sessions",
    "delivery-queue",
    "memory",
    "logs",
  ];
  for (const dir of requiredDirs) {
    fs.mkdirSync(path.join(homeDir, dir), { recursive: true });
  }
}

function copyDirRecursive(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}
