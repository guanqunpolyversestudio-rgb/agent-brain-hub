import path from "path";
import chalk from "chalk";
import {
  cleanupSnapshot,
  parseTagList,
  persistSnapshot,
  prepareSnapshot,
} from "../exporter/snapshot.js";

export interface SnapshotOptions {
  name: string;
  author: string;
  description: string;
  visibility: "public" | "private";
  version: string;
  tags: string;
  source?: string;
  output?: string;
  dryRun?: boolean;
}

export async function snapshotCommand(opts: SnapshotOptions): Promise<void> {
  console.log(chalk.blue("=== Brain Snapshot ==="));
  console.log(chalk.gray(`Source: ${opts.source || "~/.openclaw"}`));
  if (opts.output) {
    console.log(chalk.gray(`Output: ${path.resolve(opts.output)}`));
  }
  console.log();

  const prepared = await prepareSnapshot({
    name: opts.name,
    author: opts.author,
    description: opts.description,
    visibility: opts.visibility,
    version: opts.version,
    tags: parseTagList(opts.tags),
    source: opts.source,
  });

  try {
    console.log(chalk.yellow("1/4 Collected and sanitized local brain"));
    console.log(chalk.green(`   Files:      ${prepared.manifest.stats.total_files}`));
    console.log(chalk.green(`   Sanitized:  ${prepared.sanitizedCount}`));

    console.log(chalk.yellow("2/4 Packaged snapshot artifact"));
    console.log(chalk.green(`   Snapshot ID: ${prepared.manifest.id}`));

    console.log();
    console.log(chalk.blue("Snapshot Stats:"));
    console.log(`  Consciousness files: ${prepared.manifest.stats.consciousness_files}`);
    console.log(`  Memory files:        ${prepared.manifest.stats.memory_files}`);
    console.log(`  Skills:              ${prepared.manifest.stats.skills_count}`);
    console.log(`  Sessions:            ${prepared.manifest.stats.sessions_count}`);
    console.log(`  Total files:         ${prepared.manifest.stats.total_files}`);

    if (opts.dryRun) {
      console.log();
      console.log(chalk.yellow("Dry run - snapshot was prepared but not saved."));
      return;
    }

    console.log();
    console.log(chalk.yellow("3/4 Saving snapshot locally"));
    const snapshotDir = persistSnapshot(prepared, opts.output);
    console.log(chalk.green(`   Saved to ${snapshotDir}`));

    console.log(chalk.yellow("4/4 Ready to publish"));
    console.log(chalk.gray(`Publish with: openclaw_brain publish ${snapshotDir}`));
  } finally {
    cleanupSnapshot(prepared);
  }
}
