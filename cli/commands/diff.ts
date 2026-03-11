import fs from "fs";
import path from "path";
import chalk from "chalk";
import { OPENCLAW_HOME, DEFAULT_SERVER_URL } from "../../shared/types.js";

export interface DiffOptions {
  server?: string;
}

const CONSCIOUSNESS_FILES = [
  "workspace/IDENTITY.md",
  "workspace/SOUL.md",
  "workspace/MEMORY.md",
  "workspace/USER.md",
  "workspace/AGENTS.md",
];

export async function diffCommand(
  brainA: string,
  brainB: string,
  opts: DiffOptions
): Promise<void> {
  console.log(chalk.blue("=== Brain Diff ==="));
  console.log(chalk.gray(`A: ${brainA}`));
  console.log(chalk.gray(`B: ${brainB}`));
  console.log();

  const dirA = await resolveBrainDir(brainA, opts);
  const dirB = await resolveBrainDir(brainB, opts);

  if (!dirA || !dirB) return;

  for (const file of CONSCIOUSNESS_FILES) {
    const pathA = path.join(dirA, file);
    const pathB = path.join(dirB, file);

    const existsA = fs.existsSync(pathA);
    const existsB = fs.existsSync(pathB);

    const fileName = path.basename(file);
    console.log(chalk.blue(`--- ${fileName} ---`));

    if (!existsA && !existsB) {
      console.log(chalk.gray("  (not found in either brain)"));
      continue;
    }
    if (!existsA) {
      console.log(chalk.red("  A: (missing)"));
      console.log(chalk.green("  B: exists"));
      continue;
    }
    if (!existsB) {
      console.log(chalk.green("  A: exists"));
      console.log(chalk.red("  B: (missing)"));
      continue;
    }

    const contentA = fs.readFileSync(pathA, "utf-8");
    const contentB = fs.readFileSync(pathB, "utf-8");

    if (contentA === contentB) {
      console.log(chalk.gray("  (identical)"));
      continue;
    }

    // Simple line-by-line diff
    const linesA = contentA.split("\n");
    const linesB = contentB.split("\n");

    const onlyA = linesA.filter((l) => l.trim() && !linesB.includes(l));
    const onlyB = linesB.filter((l) => l.trim() && !linesA.includes(l));

    if (onlyA.length > 0) {
      console.log(chalk.red("  Only in A:"));
      for (const line of onlyA.slice(0, 10)) {
        console.log(chalk.red(`    - ${line.trim()}`));
      }
      if (onlyA.length > 10) console.log(chalk.gray(`    ... and ${onlyA.length - 10} more`));
    }

    if (onlyB.length > 0) {
      console.log(chalk.green("  Only in B:"));
      for (const line of onlyB.slice(0, 10)) {
        console.log(chalk.green(`    + ${line.trim()}`));
      }
      if (onlyB.length > 10) console.log(chalk.gray(`    ... and ${onlyB.length - 10} more`));
    }

    console.log();
  }

  // Diff skills
  console.log(chalk.blue("--- Skills ---"));
  const skillsA = getSkills(dirA);
  const skillsB = getSkills(dirB);
  const allSkills = new Set([...skillsA, ...skillsB]);

  for (const skill of allSkills) {
    const inA = skillsA.includes(skill);
    const inB = skillsB.includes(skill);
    if (inA && inB) {
      console.log(chalk.gray(`  = ${skill}`));
    } else if (inA) {
      console.log(chalk.red(`  - ${skill} (only in A)`));
    } else {
      console.log(chalk.green(`  + ${skill} (only in B)`));
    }
  }

  // Diff memory files
  console.log();
  console.log(chalk.blue("--- Memory Files ---"));
  const memA = getMemoryFiles(dirA);
  const memB = getMemoryFiles(dirB);
  const allMem = new Set([...memA, ...memB]);

  for (const mem of allMem) {
    const inA = memA.includes(mem);
    const inB = memB.includes(mem);
    if (inA && inB) {
      console.log(chalk.gray(`  = ${mem}`));
    } else if (inA) {
      console.log(chalk.red(`  - ${mem} (only in A)`));
    } else {
      console.log(chalk.green(`  + ${mem} (only in B)`));
    }
  }
}

async function resolveBrainDir(
  ref: string,
  opts: DiffOptions
): Promise<string | null> {
  if (ref === "local" || ref === "mine") {
    return OPENCLAW_HOME;
  }

  // Check if it's a local path
  if (fs.existsSync(ref) && fs.statSync(ref).isDirectory()) {
    return ref;
  }

  // Check pulled directory
  const pulledDir = path.join(process.cwd(), "pulled", ref);
  if (fs.existsSync(pulledDir)) {
    return pulledDir;
  }

  console.log(chalk.red(`Cannot resolve brain: ${ref}`));
  console.log(chalk.gray('Use "local" for your own brain, a brain ID (pull first), or a directory path.'));
  return null;
}

function getSkills(dir: string): string[] {
  const skillsDir = path.join(dir, "workspace", "skills");
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function getMemoryFiles(dir: string): string[] {
  const memDir = path.join(dir, "workspace", "memory");
  if (!fs.existsSync(memDir)) return [];
  return fs
    .readdirSync(memDir)
    .filter((f) => f.endsWith(".md"));
}
