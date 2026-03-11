import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import * as tar from "tar";
import { v4 as uuidv4 } from "uuid";
import type { BrainManifest, BrainFile, BrainStats } from "../../shared/types.js";

export interface PackageOptions {
  name: string;
  author: string;
  description: string;
  visibility: "public" | "private";
  version: string;
  tags: string[];
  openclawVersion?: string;
}

/**
 * Creates a manifest and tarballs the brain directory.
 * Returns the path to the .tar.gz and the manifest.
 */
export async function packageBrain(
  tmpDir: string,
  files: BrainFile[],
  opts: PackageOptions
): Promise<{ tarballPath: string; manifest: BrainManifest }> {
  const id = uuidv4();

  const stats = computeStats(files);
  const consciousnessFiles = files
    .filter((f) => f.category === "consciousness")
    .map((f) => f.path);

  // Detect openclaw version from config
  let openclawVersion = opts.openclawVersion || "unknown";
  const configPath = path.join(tmpDir, "openclaw.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      openclawVersion = config.meta?.lastTouchedVersion || openclawVersion;
    } catch {
      // ignore
    }
  }

  const manifest: BrainManifest = {
    id,
    name: opts.name,
    author: opts.author,
    description: opts.description,
    visibility: opts.visibility,
    version: opts.version,
    openclaw_version: openclawVersion,
    created_at: new Date().toISOString(),
    tags: opts.tags,
    files,
    consciousness_files: consciousnessFiles,
    stats,
  };

  // Write manifest into the tmp dir
  fs.writeFileSync(
    path.join(tmpDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  // Create tarball
  const tarballPath = path.join(tmpDir, `${id}.tar.gz`);
  await tar.create(
    {
      gzip: true,
      file: tarballPath,
      cwd: tmpDir,
    },
    fs.readdirSync(tmpDir).filter((f) => f !== `${id}.tar.gz`)
  );

  // Compute checksum
  const hash = createHash("sha256");
  const stream = fs.createReadStream(tarballPath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  manifest.id = id; // keep consistent

  return { tarballPath, manifest };
}

function computeStats(files: BrainFile[]): BrainStats {
  return {
    total_files: files.length,
    total_size: files.reduce((sum, f) => sum + f.size, 0),
    consciousness_files: files.filter((f) => f.category === "consciousness").length,
    memory_files: files.filter((f) => f.category === "memory").length,
    skills_count: countUniqueSkills(files),
    sessions_count: files.filter((f) => f.category === "session").length,
  };
}

function countUniqueSkills(files: BrainFile[]): number {
  const skillDirs = new Set<string>();
  for (const f of files) {
    if (f.category === "skill") {
      // Extract skill name from path like "workspace/skills/peekaboo/SKILL.md"
      const parts = f.path.split("/");
      const skillsIdx = parts.indexOf("skills");
      if (skillsIdx >= 0 && parts[skillsIdx + 1]) {
        skillDirs.add(parts[skillsIdx + 1]);
      }
    }
  }
  return skillDirs.size;
}
