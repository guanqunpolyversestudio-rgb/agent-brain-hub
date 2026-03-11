import fs from "fs";
import path from "path";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";
import { OPENCLAW_HOME } from "../../shared/types.js";
import type { MergeStrategy, MergeConflict } from "../../shared/types.js";

export interface MergeOptions {
  with: string;           // "local" or path to another brain dir
  strategy: MergeStrategy;
  output?: string;
  skipBackup?: boolean;
}

const CONSCIOUSNESS_FILES = [
  "workspace/IDENTITY.md",
  "workspace/SOUL.md",
  "workspace/MEMORY.md",
  "workspace/USER.md",
  "workspace/AGENTS.md",
  "workspace/HEARTBEAT.md",
  "workspace/TOOLS.md",
];

export async function mergeCommand(brainRef: string, opts: MergeOptions): Promise<void> {
  const strategy = opts.strategy || "manual";

  console.log(chalk.blue("=== Brain Merge ==="));
  console.log(chalk.gray(`Brain A (incoming): ${brainRef}`));
  console.log(chalk.gray(`Brain B (target):   ${opts.with}`));
  console.log(chalk.gray(`Strategy:           ${strategy}`));
  console.log();

  const dirA = resolveBrainDir(brainRef);
  const dirB = resolveBrainDir(opts.with);

  if (!dirA || !dirB) return;

  // Backup local brain before merge
  if (!opts.skipBackup) {
    const backupDir = await backupLocalBrain(dirA, dirB);
    if (!backupDir) return;
  }

  const mergeId = uuidv4().slice(0, 8);
  const outputDir = opts.output || path.join(process.cwd(), "merged", mergeId);
  fs.mkdirSync(outputDir, { recursive: true });

  const conflicts: MergeConflict[] = [];

  // Merge consciousness files
  console.log(chalk.yellow("Merging consciousness files..."));
  for (const file of CONSCIOUSNESS_FILES) {
    const result = mergeFile(dirA, dirB, file, strategy);
    const outputPath = path.join(outputDir, path.basename(file, ".md") + ".merged.md");

    if (result.conflict) {
      conflicts.push(result.conflict);
      // Write with conflict markers
      fs.writeFileSync(outputPath, result.content);
      console.log(chalk.yellow(`  ~ ${path.basename(file)} (conflicts found)`));
    } else if (result.content) {
      fs.writeFileSync(outputPath, result.content);
      console.log(chalk.green(`  + ${path.basename(file)}`));
    } else {
      console.log(chalk.gray(`  - ${path.basename(file)} (not found in either)`));
    }
  }

  // Merge memory files
  console.log();
  console.log(chalk.yellow("Merging memory files..."));
  const memoryDir = path.join(outputDir, "memory");
  fs.mkdirSync(memoryDir, { recursive: true });

  const memFilesA = getMemoryFiles(dirA);
  const memFilesB = getMemoryFiles(dirB);
  const allMemFiles = new Set([...memFilesA, ...memFilesB]);

  for (const memFile of allMemFiles) {
    const inA = memFilesA.includes(memFile);
    const inB = memFilesB.includes(memFile);

    if (inA && inB) {
      // Both have it - merge
      const contentA = readMemoryFile(dirA, memFile);
      const contentB = readMemoryFile(dirB, memFile);
      if (contentA === contentB) {
        fs.writeFileSync(path.join(memoryDir, memFile), contentA);
        console.log(chalk.gray(`  = ${memFile}`));
      } else {
        const merged = mergeText(contentA, contentB, memFile, strategy);
        fs.writeFileSync(path.join(memoryDir, memFile), merged.content);
        console.log(chalk.yellow(`  ~ ${memFile} (merged)`));
      }
    } else {
      // Only in one - copy as-is
      const sourceDir = inA ? dirA : dirB;
      const content = readMemoryFile(sourceDir, memFile);
      fs.writeFileSync(path.join(memoryDir, memFile), content);
      const label = inA ? "A" : "B";
      console.log(chalk.green(`  + ${memFile} (from ${label})`));
    }
  }

  // Merge skills (union)
  console.log();
  console.log(chalk.yellow("Merging skills..."));
  const skillsDir = path.join(outputDir, "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  const skillsA = getSkills(dirA);
  const skillsB = getSkills(dirB);
  const allSkills = new Set([...skillsA, ...skillsB]);

  for (const skill of allSkills) {
    const inA = skillsA.includes(skill);
    const inB = skillsB.includes(skill);

    // Prefer B (target) if both have it, otherwise take whichever has it
    const sourceDir = inB ? dirB : dirA;
    const srcSkillDir = path.join(sourceDir, "workspace", "skills", skill);
    const dstSkillDir = path.join(skillsDir, skill);

    copyDirRecursive(srcSkillDir, dstSkillDir);
    const label = inA && inB ? "both (kept B)" : inA ? "A" : "B";
    console.log(chalk.green(`  + ${skill} (from ${label})`));
  }

  // Generate merge report
  console.log();
  console.log(chalk.yellow("Generating merge report..."));
  const report = generateMergeReport(dirA, dirB, brainRef, opts.with, strategy, conflicts);
  fs.writeFileSync(path.join(outputDir, "MERGE_REPORT.md"), report);

  if (conflicts.length > 0) {
    const conflictsContent = generateConflictsFile(conflicts);
    fs.writeFileSync(path.join(outputDir, "CONFLICTS.md"), conflictsContent);
  }

  console.log();
  console.log(chalk.blue("=== Merge Complete ==="));
  console.log(`Output:    ${outputDir}`);
  console.log(`Conflicts: ${conflicts.length}`);
  console.log();
  console.log(chalk.gray("Files:"));

  const outputFiles = fs.readdirSync(outputDir);
  for (const f of outputFiles) {
    const stat = fs.statSync(path.join(outputDir, f));
    if (stat.isDirectory()) {
      console.log(chalk.gray(`  ${f}/`));
    } else {
      console.log(chalk.gray(`  ${f}`));
    }
  }

  if (conflicts.length > 0) {
    console.log();
    console.log(chalk.yellow("Review CONFLICTS.md and edit the .merged.md files to resolve."));
  }
}

/**
 * Full backup of ~/.openclaw/ before merge.
 * Copies everything so we can restore to exact pre-merge state.
 */
async function backupLocalBrain(dirA: string, dirB: string): Promise<string | null> {
  const dirsToBackup = new Set<string>();

  for (const dir of [dirA, dirB]) {
    const resolvedDir = path.resolve(dir);
    if (fs.existsSync(path.join(resolvedDir, "workspace"))) {
      dirsToBackup.add(resolvedDir);
    }
  }

  if (dirsToBackup.size === 0) {
    console.log(chalk.gray("No local brain to backup, skipping."));
    return "skipped";
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupBase = path.join(process.cwd(), "backups", timestamp);
  fs.mkdirSync(backupBase, { recursive: true });

  console.log(chalk.yellow("Backing up local brain before merge..."));

  for (const dir of dirsToBackup) {
    const label = dir === OPENCLAW_HOME ? "local" : path.basename(dir);
    const backupDir = path.join(backupBase, label);

    // Full copy of the entire directory
    copyDirRecursive(dir, backupDir);

    const fileCount = countFiles(backupDir);
    const size = getDirSize(backupDir);
    console.log(chalk.green(`  Backed up ${label}: ${fileCount} files (${formatSize(size)}) → ${backupDir}`));
  }

  console.log(chalk.green(`  Backup location: ${backupBase}`));
  console.log(chalk.gray(`  Restore with: rm -rf ~/.openclaw && cp -r ${backupBase}/local ~/.openclaw`));
  console.log();

  return backupBase;
}

function countFiles(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

function getDirSize(dir: string): number {
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function resolveBrainDir(ref: string): string | null {
  if (ref === "local" || ref === "mine") return OPENCLAW_HOME;
  if (fs.existsSync(ref) && fs.statSync(ref).isDirectory()) return ref;
  const pulledDir = path.join(process.cwd(), "pulled", ref);
  if (fs.existsSync(pulledDir)) return pulledDir;
  console.log(chalk.red(`Cannot resolve brain: ${ref}`));
  return null;
}

interface MergeFileResult {
  content: string;
  conflict?: MergeConflict;
}

function mergeFile(
  dirA: string,
  dirB: string,
  file: string,
  strategy: MergeStrategy
): MergeFileResult {
  const pathA = path.join(dirA, file);
  const pathB = path.join(dirB, file);
  const existsA = fs.existsSync(pathA);
  const existsB = fs.existsSync(pathB);

  if (!existsA && !existsB) return { content: "" };
  if (!existsA) return { content: fs.readFileSync(pathB, "utf-8") };
  if (!existsB) return { content: fs.readFileSync(pathA, "utf-8") };

  const contentA = fs.readFileSync(pathA, "utf-8");
  const contentB = fs.readFileSync(pathB, "utf-8");

  if (contentA === contentB) return { content: contentA };

  return mergeText(contentA, contentB, file, strategy);
}

function mergeText(
  contentA: string,
  contentB: string,
  fileName: string,
  strategy: MergeStrategy
): MergeFileResult {
  switch (strategy) {
    case "prefer-a":
      return { content: contentA };
    case "prefer-b":
      return { content: contentB };
    case "union": {
      // Simple union: combine unique lines
      const linesA = contentA.split("\n");
      const linesB = contentB.split("\n");
      const combined = [...linesA];
      for (const line of linesB) {
        if (!linesA.includes(line)) combined.push(line);
      }
      return { content: combined.join("\n") };
    }
    case "manual":
    default: {
      // Git-style conflict markers
      const merged = [
        `<<<<<<< Brain A`,
        contentA.trim(),
        `=======`,
        contentB.trim(),
        `>>>>>>> Brain B`,
        "",
      ].join("\n");

      return {
        content: merged,
        conflict: {
          file: fileName,
          section: path.basename(fileName),
          content_a: contentA,
          content_b: contentB,
        },
      };
    }
  }
}

function generateMergeReport(
  dirA: string,
  dirB: string,
  refA: string,
  refB: string,
  strategy: MergeStrategy,
  conflicts: MergeConflict[]
): string {
  return `# Brain Merge Report

## Source Brains
- **Brain A (incoming):** ${refA}
- **Brain B (target):** ${refB}

## Strategy
\`${strategy}\`

## Date
${new Date().toISOString()}

## Consciousness Files Merged
${CONSCIOUSNESS_FILES.map((f) => `- ${path.basename(f)}`).join("\n")}

## Conflicts
${conflicts.length === 0 ? "None" : conflicts.map((c) => `- ${c.file}: ${c.section}`).join("\n")}

## How to Apply
1. Review the \`.merged.md\` files in this directory
2. Resolve any conflicts marked with \`<<<<<<<\` / \`=======\` / \`>>>>>>>\`
3. Copy the final files to your OpenClaw workspace:
   \`\`\`bash
   cp IDENTITY.merged.md ~/.openclaw/workspace/IDENTITY.md
   cp SOUL.merged.md ~/.openclaw/workspace/SOUL.md
   cp MEMORY.merged.md ~/.openclaw/workspace/MEMORY.md
   cp USER.merged.md ~/.openclaw/workspace/USER.md
   cp AGENTS.merged.md ~/.openclaw/workspace/AGENTS.md
   \`\`\`
4. Copy merged memory files:
   \`\`\`bash
   cp memory/*.md ~/.openclaw/workspace/memory/
   \`\`\`
5. Copy merged skills:
   \`\`\`bash
   cp -r skills/* ~/.openclaw/workspace/skills/
   \`\`\`
`;
}

function generateConflictsFile(conflicts: MergeConflict[]): string {
  let content = `# Merge Conflicts\n\nThe following files have conflicts that need manual resolution.\n\n`;
  for (const c of conflicts) {
    content += `## ${c.file}\n\n`;
    content += `### Brain A version:\n\`\`\`\n${c.content_a.slice(0, 500)}\n\`\`\`\n\n`;
    content += `### Brain B version:\n\`\`\`\n${c.content_b.slice(0, 500)}\n\`\`\`\n\n---\n\n`;
  }
  return content;
}

function readMemoryFile(dir: string, filename: string): string {
  const filePath = path.join(dir, "workspace", "memory", filename);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

function getMemoryFiles(dir: string): string[] {
  const memDir = path.join(dir, "workspace", "memory");
  if (!fs.existsSync(memDir)) return [];
  return fs.readdirSync(memDir).filter((f) => f.endsWith(".md"));
}

function getSkills(dir: string): string[] {
  const skillsDir = path.join(dir, "workspace", "skills");
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function copyDirRecursive(src: string, dst: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });

  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch {
    return; // directory disappeared or unreadable
  }

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    try {
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    } catch {
      // file disappeared or is locked — skip silently
    }
  }
}
