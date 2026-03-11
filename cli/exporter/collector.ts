import fs from "fs";
import path from "path";
import os from "os";
import { OPENCLAW_HOME, type BrainFile, type BrainFileCategory } from "../../shared/types.js";
import { SKIP_PATHS, SKIP_EXTENSIONS } from "../../shared/sanitize-rules.js";

/**
 * Copies ~/.openclaw/ to a temp directory, skipping paths that should be excluded.
 * Returns the temp directory path and a list of copied files.
 */
export async function collectBrain(sourceDir?: string): Promise<{
  tmpDir: string;
  files: BrainFile[];
}> {
  const src = sourceDir || OPENCLAW_HOME;

  if (!fs.existsSync(src)) {
    throw new Error(`OpenClaw directory not found: ${src}`);
  }

  // Create temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-export-"));
  const files: BrainFile[] = [];

  // Walk and copy
  await copyDir(src, tmpDir, "", files);

  return { tmpDir, files };
}

async function copyDir(
  srcBase: string,
  dstBase: string,
  relativePath: string,
  files: BrainFile[]
): Promise<void> {
  const srcPath = path.join(srcBase, relativePath);
  const dstPath = path.join(dstBase, relativePath);

  const entries = fs.readdirSync(srcPath, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    // Check if this path should be skipped
    if (shouldSkip(relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      fs.mkdirSync(path.join(dstBase, relPath), { recursive: true });
      await copyDir(srcBase, dstBase, relPath, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SKIP_EXTENSIONS.includes(ext)) {
        continue;
      }

      const srcFile = path.join(srcBase, relPath);
      const dstFile = path.join(dstBase, relPath);

      // Ensure parent dir exists
      fs.mkdirSync(path.dirname(dstFile), { recursive: true });
      fs.copyFileSync(srcFile, dstFile);

      const stat = fs.statSync(dstFile);
      files.push({
        path: relPath,
        size: stat.size,
        category: categorizeFile(relPath),
        sanitized: false,
      });
    }
  }
}

function shouldSkip(relPath: string): boolean {
  for (const skipPath of SKIP_PATHS) {
    if (relPath === skipPath || relPath.startsWith(skipPath + "/")) {
      return true;
    }
  }
  // Skip hidden dirs except workspace-level ones we care about
  const basename = path.basename(relPath);
  if (basename.startsWith(".") && basename !== ".openclaw") {
    // Allow certain dotfiles at workspace level
    return true;
  }
  return false;
}

function categorizeFile(relPath: string): BrainFileCategory {
  // Consciousness core files
  const consciousnessFiles = [
    "workspace/IDENTITY.md",
    "workspace/SOUL.md",
    "workspace/MEMORY.md",
    "workspace/USER.md",
    "workspace/AGENTS.md",
    "workspace/HEARTBEAT.md",
    "workspace/TOOLS.md",
  ];
  if (consciousnessFiles.includes(relPath)) return "consciousness";

  // Memory
  if (relPath.startsWith("workspace/memory/")) return "memory";
  if (relPath.startsWith("memory/")) return "memory";

  // Skills
  if (relPath.startsWith("workspace/skills/")) return "skill";
  if (relPath.startsWith("skills/")) return "skill";

  // Config
  if (relPath === "openclaw.json" || relPath.endsWith(".json.bak")) return "config";
  if (relPath.startsWith("cron/")) return "config";
  if (relPath.startsWith("devices/")) return "config";

  // Sessions
  if (relPath.startsWith("agents/main/sessions/")) return "session";

  // Logs
  if (relPath.startsWith("logs/")) return "log";

  // Media (PNGs in workspace)
  if (relPath.endsWith(".png") || relPath.endsWith(".jpg")) return "media";

  return "other";
}
