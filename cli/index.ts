#!/usr/bin/env node
import { Command } from "commander";
import { snapshotCommand } from "./commands/snapshot.js";
import { publishCommand } from "./commands/publish.js";
import { fetchCommand } from "./commands/fetch.js";
import { pushCommand } from "./commands/push.js";
import { pullCommand } from "./commands/pull.js";
import { listCommand } from "./commands/list.js";
import { diffCommand } from "./commands/diff.js";
import { mergeCommand } from "./commands/merge.js";
import { launchCommand } from "./commands/launch.js";
import { loginCommand, logoutCommand, whoamiCommand, loadAuthToken } from "./commands/login.js";
import { DEFAULT_SERVER_URL } from "../shared/types.js";

const program = new Command();

program
  .name("openclaw_brain")
  .description("OpenClaw Brain Hub CLI - share, pull, and merge agent brains")
  .version("0.1.0")
  .option("--server <url>", "Server URL", process.env.BRAIN_HUB_URL || DEFAULT_SERVER_URL);

program
  .command("login")
  .description("Login with Google via browser")
  .action(async (opts) => {
    await loginCommand(opts);
  });

program
  .command("logout")
  .description("Remove saved login credentials")
  .action(async () => {
    await logoutCommand();
  });

program
  .command("whoami")
  .description("Show current logged-in user")
  .action(async () => {
    await whoamiCommand();
  });

program
  .command("snapshot")
  .description("Create a sanitized local snapshot from your OpenClaw home")
  .requiredOption("-n, --name <name>", "Snapshot name (e.g. 瑞希)")
  .option("-a, --author <author>", "Author name (auto-detected from login)")
  .option("-d, --description <desc>", "Snapshot description", "")
  .option("-v, --version <version>", "Snapshot version", "1.0.0")
  .option("--visibility <visibility>", "public or private", "public")
  .option("-t, --tags <tags>", "Comma-separated tags", "")
  .option("-s, --source <path>", "Source directory (default: ~/.openclaw)")
  .option("-o, --output <path>", "Output directory for the saved snapshot")
  .option("--dry-run", "Prepare a snapshot without saving it")
  .action(async (opts) => {
    if (!opts.author) {
      const { loadAuthUser } = await import("./commands/login.js");
      const user = loadAuthUser();
      opts.author = user?.name || user?.email || "anonymous";
    }
    await snapshotCommand(opts);
  });

program
  .command("publish <snapshot-path>")
  .description("Publish a saved local snapshot to the hub")
  .action(async (snapshotPath, opts) => {
    opts.server = opts.server || program.opts().server;
    opts.authToken = loadAuthToken();
    await publishCommand(snapshotPath, opts);
  });

program
  .command("fetch <brain-id>")
  .description("Fetch a published snapshot from the hub")
  .option("-o, --output <path>", "Output directory")
  .action(async (brainId, opts) => {
    opts.server = opts.server || program.opts().server;
    await fetchCommand(brainId, opts);
  });

program
  .command("push")
  .description("Legacy convenience command: snapshot your local brain and publish it")
  .requiredOption("-n, --name <name>", "Brain name (e.g. 瑞希)")
  .option("-a, --author <author>", "Author name (auto-detected from login)")
  .option("-d, --description <desc>", "Brain description", "")
  .option("-v, --version <version>", "Brain version", "1.0.0")
  .option("--visibility <visibility>", "public or private", "public")
  .option("-t, --tags <tags>", "Comma-separated tags", "")
  .option("-s, --source <path>", "Source directory (default: ~/.openclaw)")
  .option("--dry-run", "Package but don't upload")
  .action(async (opts) => {
    opts.server = opts.server || program.opts().server;
    // Auto-fill author from login if not provided
    if (!opts.author) {
      const { loadAuthUser } = await import("./commands/login.js");
      const user = loadAuthUser();
      opts.author = user?.name || user?.email || "anonymous";
    }
    // Attach auth token for authenticated upload
    opts.authToken = loadAuthToken();
    await pushCommand(opts);
  });

program
  .command("pull <brain-id>")
  .description("Legacy alias for fetch")
  .option("-o, --output <path>", "Output directory")
  .action(async (brainId, opts) => {
    opts.server = opts.server || program.opts().server;
    await pullCommand(brainId, opts);
  });

program
  .command("list")
  .description("List public brains on the hub")
  .option("--author <author>", "Filter by author")
  .option("--tag <tag>", "Filter by tag")
  .action(async (opts) => {
    opts.server = opts.server || program.opts().server;
    await listCommand(opts);
  });

program
  .command("diff <brain-a> <brain-b>")
  .description('Compare two brains (use "local" for your own)')
  .action(async (brainA, brainB, opts) => {
    opts.server = opts.server || program.opts().server;
    await diffCommand(brainA, brainB, opts);
  });

program
  .command("merge <brain-ref>")
  .description("Merge a brain with your local brain")
  .option("-w, --with <ref>", "Target brain to merge with", "local")
  .option("--strategy <strategy>", "Merge strategy: union, prefer-a, prefer-b, manual", "manual")
  .option("-o, --output <path>", "Output directory")
  .option("--skip-backup", "Skip local backup before merge")
  .action(async (brainRef, opts) => {
    await mergeCommand(brainRef, opts);
  });

program
  .command("launch <brain-ref>")
  .description("Launch a new OpenClaw instance with a brain")
  .option("-p, --port <port>", "Gateway port", parseInt as unknown as undefined)
  .action(async (brainRef, opts) => {
    await launchCommand(brainRef, opts);
  });

program.parse();
