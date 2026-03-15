import fs from "fs";
import chalk from "chalk";
import { DEFAULT_SERVER_URL } from "../../shared/types.js";
import type { BrainManifest } from "../../shared/types.js";
import { loadSnapshot } from "../exporter/snapshot.js";

export interface PublishOptions {
  server?: string;
  authToken?: string | null;
}

export interface UploadOptions {
  serverUrl: string;
  authToken?: string | null;
}

export async function publishCommand(
  snapshotRef: string,
  opts: PublishOptions
): Promise<void> {
  const serverUrl = opts.server || DEFAULT_SERVER_URL;
  const snapshot = loadSnapshot(snapshotRef);

  console.log(chalk.blue("=== Brain Publish ==="));
  console.log(chalk.gray(`Snapshot: ${snapshot.snapshotDir}`));
  console.log(chalk.gray(`Server:   ${serverUrl}`));
  console.log();

  console.log(chalk.yellow("1/2 Loading snapshot..."));
  console.log(chalk.green(`   ${snapshot.manifest.name} by ${snapshot.manifest.author}`));
  console.log(chalk.gray(`   Version: ${snapshot.manifest.version} | Visibility: ${snapshot.manifest.visibility}`));
  console.log();

  console.log(chalk.yellow("2/2 Uploading to server..."));
  let result: { id: string };
  try {
    result = await uploadSnapshotArtifacts(snapshot.manifest, snapshot.tarballPath, {
      serverUrl,
      authToken: opts.authToken,
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Cannot connect to server")) {
      console.log(chalk.red(`   ${err.message}`));
      console.log(chalk.gray("   Override with --server <url> if needed."));
      return;
    }
    throw err;
  }

  console.log(chalk.green("   Uploaded successfully!"));
  console.log();
  console.log(chalk.blue(`Brain ID: ${chalk.bold(result.id)}`));
  console.log(chalk.gray(`Fetch with: openclaw_brain fetch ${result.id}`));
}

export async function uploadSnapshotArtifacts(
  manifest: BrainManifest,
  tarballPath: string,
  opts: UploadOptions
): Promise<{ id: string }> {
  const formData = new FormData();
  const blob = typeof fs.openAsBlob === "function"
    ? await fs.openAsBlob(tarballPath, { type: "application/gzip" })
    : new Blob([fs.readFileSync(tarballPath)], { type: "application/gzip" });
  formData.append("brain", blob, `${manifest.id}.tar.gz`);
  formData.append("manifest", JSON.stringify(manifest));

  const headers: Record<string, string> = {};
  if (opts.authToken) {
    headers["Authorization"] = `Bearer ${opts.authToken}`;
  }

  try {
    const res = await fetch(`${opts.serverUrl}/brains`, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server responded with ${res.status}: ${text}`);
    }

    return await res.json() as { id: string };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("ECONNREFUSED") ||
        err.message.includes("fetch failed") ||
        err.message.includes("bad port"))
    ) {
      throw new Error(`Cannot connect to server at ${opts.serverUrl}`);
    }

    throw err;
  }
}
