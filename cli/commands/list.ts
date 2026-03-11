import chalk from "chalk";
import { DEFAULT_SERVER_URL } from "../../shared/types.js";
import type { BrainRecord } from "../../shared/types.js";

export interface ListOptions {
  server?: string;
  author?: string;
  tag?: string;
}

export async function listCommand(opts: ListOptions): Promise<void> {
  const serverUrl = opts.server || DEFAULT_SERVER_URL;

  const params = new URLSearchParams();
  if (opts.author) params.set("author", opts.author);
  if (opts.tag) params.set("tag", opts.tag);

  const url = `${serverUrl}/brains?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const brains = await res.json() as BrainRecord[];

    if (brains.length === 0) {
      console.log(chalk.gray("No public brains found."));
      return;
    }

    console.log(chalk.blue("=== Public Brains ==="));
    console.log();

    // Table header
    const idW = 12;
    const nameW = 16;
    const authorW = 12;
    const verW = 8;
    const sizeW = 8;
    const dateW = 10;

    console.log(
      chalk.bold(
        pad("ID", idW) +
          pad("NAME", nameW) +
          pad("AUTHOR", authorW) +
          pad("VER", verW) +
          pad("SIZE", sizeW) +
          pad("CREATED", dateW)
      )
    );
    console.log(chalk.gray("-".repeat(idW + nameW + authorW + verW + sizeW + dateW)));

    for (const brain of brains) {
      const id = brain.id.slice(0, 10) + "..";
      const date = brain.created_at.slice(0, 10);
      const size = formatSize(brain.file_size);
      const tags = brain.tags ? JSON.parse(brain.tags).join(", ") : "";

      console.log(
        pad(id, idW) +
          pad(brain.name, nameW) +
          pad(brain.author, authorW) +
          pad(brain.version, verW) +
          pad(size, sizeW) +
          pad(date, dateW) +
          (tags ? chalk.gray(` [${tags}]`) : "")
      );
    }

    console.log();
    console.log(chalk.gray(`${brains.length} brain(s) found.`));
  } catch (err) {
    if (err instanceof Error && err.message.includes("ECONNREFUSED")) {
      console.log(chalk.red(`Cannot connect to server at ${serverUrl}`));
      console.log(chalk.gray("Start the server with: npm run server"));
    } else {
      throw err;
    }
  }
}

function pad(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width - 1) + " ";
  return str + " ".repeat(width - str.length);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
