import fs from "fs";
import path from "path";
import chalk from "chalk";
import * as tar from "tar";
import { DEFAULT_SERVER_URL } from "../../shared/types.js";
import type { BrainManifest } from "../../shared/types.js";

export interface PullOptions {
  output?: string;
  server?: string;
}

export async function pullCommand(brainId: string, opts: PullOptions): Promise<void> {
  const serverUrl = opts.server || DEFAULT_SERVER_URL;
  const outputDir = opts.output || path.join(process.cwd(), "pulled", brainId);

  console.log(chalk.blue("=== Brain Pull ==="));
  console.log(chalk.gray(`Brain ID: ${brainId}`));
  console.log(chalk.gray(`Server:   ${serverUrl}`));
  console.log();

  // Step 1: Download
  console.log(chalk.yellow("1/3 Downloading brain..."));
  const res = await fetch(`${serverUrl}/brains/${brainId}`);
  if (!res.ok) {
    if (res.status === 404) {
      console.log(chalk.red(`Brain not found: ${brainId}`));
      return;
    }
    throw new Error(`Server responded with ${res.status}: ${await res.text()}`);
  }

  const data = await res.json() as { manifest: BrainManifest; download_url: string };
  const manifest = data.manifest;

  console.log(chalk.green(`   Found: ${manifest.name} by ${manifest.author}`));
  console.log(chalk.gray(`   Version: ${manifest.version} | OpenClaw: ${manifest.openclaw_version}`));
  console.log();

  // Step 2: Download tarball
  console.log(chalk.yellow("2/3 Downloading tarball..."));
  const tarRes = await fetch(`${serverUrl}${data.download_url}`);
  if (!tarRes.ok) {
    throw new Error(`Failed to download tarball: ${tarRes.status}`);
  }

  const tarBuffer = Buffer.from(await tarRes.arrayBuffer());
  fs.mkdirSync(outputDir, { recursive: true });

  const tarPath = path.join(outputDir, `${brainId}.tar.gz`);
  fs.writeFileSync(tarPath, tarBuffer);
  console.log(chalk.green(`   Downloaded ${formatSize(tarBuffer.length)}`));

  // Step 3: Extract
  console.log(chalk.yellow("3/3 Extracting..."));
  await tar.extract({
    file: tarPath,
    cwd: outputDir,
  });
  fs.unlinkSync(tarPath); // remove tarball after extraction
  console.log(chalk.green(`   Extracted to ${outputDir}`));

  // Show consciousness overview
  console.log();
  console.log(chalk.blue("=== Consciousness Overview ==="));
  for (const cFile of manifest.consciousness_files) {
    const filePath = path.join(outputDir, cFile);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const preview = content.slice(0, 200).replace(/\n/g, " ").trim();
      console.log(chalk.yellow(`  ${cFile}:`));
      console.log(chalk.gray(`    ${preview}...`));
    }
  }

  console.log();
  console.log(chalk.blue("Stats:"));
  console.log(`  Files:  ${manifest.stats.total_files}`);
  console.log(`  Skills: ${manifest.stats.skills_count}`);
  console.log(`  Memory: ${manifest.stats.memory_files} files`);
  console.log();
  console.log(chalk.gray(`Merge with your brain: brain merge ${brainId}`));
  console.log(chalk.gray(`Launch as new agent:   brain launch ${brainId}`));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
