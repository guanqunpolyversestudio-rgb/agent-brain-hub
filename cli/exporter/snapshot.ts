import fs from "fs";
import path from "path";
import type { BrainFile, BrainManifest } from "../../shared/types.js";
import { collectBrain } from "./collector.js";
import { sanitizeBrain } from "./sanitizer.js";
import { packageBrain } from "./packager.js";

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || ".";
const OPENCLAW_BRAIN_HOME = path.join(HOME_DIR, ".openclaw_brain");

export interface SnapshotMetadata {
  name: string;
  author: string;
  description: string;
  visibility: "public" | "private";
  version: string;
  tags: string[];
  source?: string;
}

export interface PreparedSnapshot {
  workDir: string;
  tarballPath: string;
  manifest: BrainManifest;
  files: BrainFile[];
  sanitizedCount: number;
}

export interface LoadedSnapshot {
  snapshotDir: string;
  tarballPath: string;
  manifest: BrainManifest;
}

export function parseTagList(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function prepareSnapshot(opts: SnapshotMetadata): Promise<PreparedSnapshot> {
  const { tmpDir, files } = await collectBrain(opts.source);
  sanitizeBrain(tmpDir, files);

  const { tarballPath, manifest } = await packageBrain(tmpDir, files, {
    name: opts.name,
    author: opts.author,
    description: opts.description,
    visibility: opts.visibility,
    version: opts.version,
    tags: opts.tags,
  });

  return {
    workDir: tmpDir,
    tarballPath,
    manifest,
    files,
    sanitizedCount: files.filter((file) => file.sanitized).length,
  };
}

export function persistSnapshot(prepared: PreparedSnapshot, outputDir?: string): string {
  const snapshotDir = outputDir
    ? path.resolve(outputDir)
    : path.join(getDataDir(), "snapshots", prepared.manifest.id);

  if (fs.existsSync(snapshotDir) && fs.readdirSync(snapshotDir).length > 0) {
    throw new Error(`Snapshot output already exists: ${snapshotDir}`);
  }

  fs.mkdirSync(snapshotDir, { recursive: true });
  copyDirRecursive(prepared.workDir, snapshotDir);
  return snapshotDir;
}

export function cleanupSnapshot(prepared: PreparedSnapshot): void {
  fs.rmSync(prepared.workDir, { recursive: true, force: true });
}

export function loadSnapshot(snapshotRef: string): LoadedSnapshot {
  const resolvedPath = path.resolve(snapshotRef);
  const snapshotDir = fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()
    ? path.dirname(resolvedPath)
    : resolvedPath;

  if (!fs.existsSync(snapshotDir) || !fs.statSync(snapshotDir).isDirectory()) {
    throw new Error(`Snapshot directory not found: ${snapshotRef}`);
  }

  const manifestPath = path.join(snapshotDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Snapshot manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as BrainManifest;

  let tarballPath =
    fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()
      ? resolvedPath
      : path.join(snapshotDir, `${manifest.id}.tar.gz`);

  if (!fs.existsSync(tarballPath)) {
    const tarballs = fs
      .readdirSync(snapshotDir)
      .filter((file) => file.endsWith(".tar.gz"))
      .sort();

    if (tarballs.length === 0) {
      throw new Error(`Snapshot tarball not found in ${snapshotDir}`);
    }

    tarballPath = path.join(snapshotDir, tarballs[0]);
  }

  return {
    snapshotDir,
    tarballPath,
    manifest,
  };
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

function getDataDir(): string {
  return OPENCLAW_BRAIN_HOME;
}
