import fs from "fs";
import path from "path";
import chalk from "chalk";
import { collectBrain } from "../exporter/collector.js";
import { sanitizeBrain } from "../exporter/sanitizer.js";
import { packageBrain } from "../exporter/packager.js";
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
}

export async function pushCommand(opts: PushOptions): Promise<void> {
  const serverUrl = opts.server || DEFAULT_SERVER_URL;
  const tags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : [];

  console.log(chalk.blue("=== Brain Push ==="));
  console.log(chalk.gray(`Source: ${opts.source || "~/.openclaw"}`));
  console.log(chalk.gray(`Server: ${serverUrl}`));
  console.log();

  // Step 1: Collect (copy to tmp)
  console.log(chalk.yellow("1/4 Collecting brain files..."));
  const { tmpDir, files } = await collectBrain(opts.source);
  console.log(chalk.green(`   Copied ${files.length} files to ${tmpDir}`));

  // Step 2: Sanitize
  console.log(chalk.yellow("2/4 Sanitizing sensitive data..."));
  sanitizeBrain(tmpDir, files);
  const sanitizedCount = files.filter((f) => f.sanitized).length;
  console.log(chalk.green(`   Sanitized ${sanitizedCount} files`));

  // Step 3: Package
  console.log(chalk.yellow("3/4 Packaging brain..."));
  const { tarballPath, manifest } = await packageBrain(tmpDir, files, {
    name: opts.name,
    author: opts.author,
    description: opts.description,
    visibility: opts.visibility as "public" | "private",
    version: opts.version,
    tags,
  });
  const tarSize = fs.statSync(tarballPath).size;
  console.log(chalk.green(`   Created ${path.basename(tarballPath)} (${formatSize(tarSize)})`));

  // Print stats
  console.log();
  console.log(chalk.blue("Brain Stats:"));
  console.log(`  Consciousness files: ${manifest.stats.consciousness_files}`);
  console.log(`  Memory files:        ${manifest.stats.memory_files}`);
  console.log(`  Skills:              ${manifest.stats.skills_count}`);
  console.log(`  Sessions:            ${manifest.stats.sessions_count}`);
  console.log(`  Total files:         ${manifest.stats.total_files}`);
  console.log(`  Total size:          ${formatSize(manifest.stats.total_size)}`);
  console.log();

  if (opts.dryRun) {
    console.log(chalk.yellow("Dry run - not uploading. Files at: " + tmpDir));
    console.log(chalk.gray("Manifest:"));
    const { files: _files, ...manifestSummary } = manifest;
    console.log(JSON.stringify(manifestSummary, null, 2));
    return;
  }

  // Step 4: Upload
  console.log(chalk.yellow("4/4 Uploading to server..."));
  try {
    const formData = new FormData();
    const tarballBuffer = fs.readFileSync(tarballPath);
    const blob = new Blob([tarballBuffer]);
    formData.append("brain", blob, `${manifest.id}.tar.gz`);
    formData.append("manifest", JSON.stringify(manifest));

    const res = await fetch(`${serverUrl}/brains`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server responded with ${res.status}: ${text}`);
    }

    const result = await res.json() as { id: string };
    console.log(chalk.green(`   Uploaded successfully!`));
    console.log();
    console.log(chalk.blue(`Brain ID: ${chalk.bold(result.id)}`));
    console.log(chalk.gray(`Pull with: brain pull ${result.id}`));
  } catch (err) {
    if (err instanceof Error && err.message.includes("ECONNREFUSED")) {
      console.log(chalk.red(`   Cannot connect to server at ${serverUrl}`));
      console.log(chalk.gray("   Start the server with: npm run server"));
    } else {
      throw err;
    }
  }

  // Cleanup tmp
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
