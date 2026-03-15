import fs from "fs";
import path from "path";
import chalk from "chalk";
import { cleanupSnapshot, parseTagList, prepareSnapshot } from "../exporter/snapshot.js";
import { uploadSnapshotArtifacts } from "./publish.js";
import { DEFAULT_SERVER_URL } from "../../shared/types.js";

export interface PushOptions {
  name: string;
  author: string;
  description: string;
  visibility: "public" | "private";
  version: string;
  tags: string;
  source?: string;
  server?: string;
  dryRun?: boolean;
  authToken?: string | null;
}

export async function pushCommand(opts: PushOptions): Promise<void> {
  const serverUrl = opts.server || DEFAULT_SERVER_URL;
  const tags = parseTagList(opts.tags);

  console.log(chalk.blue("=== Brain Push ==="));
  console.log(chalk.gray(`Source: ${opts.source || "~/.openclaw"}`));
  console.log(chalk.gray(`Server: ${serverUrl}`));
  console.log();

  const prepared = await prepareSnapshot({
    name: opts.name,
    author: opts.author,
    description: opts.description,
    visibility: opts.visibility,
    version: opts.version,
    tags,
    source: opts.source,
  });

  try {
    const tarSize = fs.statSync(prepared.tarballPath).size;
    console.log(chalk.yellow("1/4 Collected and sanitized local brain"));
    console.log(chalk.green(`   Files:      ${prepared.manifest.stats.total_files}`));
    console.log(chalk.green(`   Sanitized:  ${prepared.sanitizedCount}`));

    console.log(chalk.yellow("2/4 Packaging brain..."));
    console.log(
      chalk.green(
        `   Created ${path.basename(prepared.tarballPath)} (${formatSize(tarSize)})`
      )
    );

    console.log();
    console.log(chalk.blue("Brain Stats:"));
    console.log(`  Consciousness files: ${prepared.manifest.stats.consciousness_files}`);
    console.log(`  Memory files:        ${prepared.manifest.stats.memory_files}`);
    console.log(`  Skills:              ${prepared.manifest.stats.skills_count}`);
    console.log(`  Sessions:            ${prepared.manifest.stats.sessions_count}`);
    console.log(`  Total files:         ${prepared.manifest.stats.total_files}`);
    console.log(`  Total size:          ${formatSize(prepared.manifest.stats.total_size)}`);
    console.log();

    if (opts.dryRun) {
      console.log(chalk.yellow("Dry run - snapshot prepared but not uploaded."));
      console.log(chalk.gray("Manifest:"));
      const { files: _files, ...manifestSummary } = prepared.manifest;
      console.log(JSON.stringify(manifestSummary, null, 2));
      return;
    }

    console.log(chalk.yellow("3/4 Snapshot prepared in memory"));
    console.log(chalk.green(`   Snapshot ID: ${prepared.manifest.id}`));
    console.log(chalk.yellow("4/4 Uploading to server..."));

    const result = await uploadSnapshotArtifacts(prepared.manifest, prepared.tarballPath, {
      serverUrl,
      authToken: opts.authToken,
    });

    console.log(chalk.green("   Uploaded successfully!"));
    console.log();
    console.log(chalk.blue(`Brain ID: ${chalk.bold(result.id)}`));
    console.log(chalk.gray(`Fetch with: openclaw_brain fetch ${result.id}`));
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Cannot connect to server")) {
      console.log(chalk.red(`   ${err.message}`));
      console.log(chalk.gray("   Override with --server <url> if needed."));
      return;
    }

    throw err;
  } finally {
    cleanupSnapshot(prepared);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
