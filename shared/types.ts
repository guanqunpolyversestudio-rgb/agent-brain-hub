export interface BrainManifest {
  id: string;
  name: string;
  author: string;
  description: string;
  visibility: "public" | "private";
  version: string;
  openclaw_version: string;
  created_at: string;
  tags: string[];
  files: BrainFile[];
  consciousness_files: string[];
  stats: BrainStats;
}

export interface BrainFile {
  path: string;          // relative to brain root
  size: number;
  category: BrainFileCategory;
  sanitized: boolean;    // true if content was modified during sanitization
}

export type BrainFileCategory =
  | "consciousness"      // IDENTITY.md, SOUL.md, MEMORY.md, USER.md, AGENTS.md
  | "memory"             // workspace/memory/*.md + memory/main.sqlite
  | "skill"              // workspace/skills/**
  | "config"             // openclaw.json, cron/jobs.json
  | "session"            // agents/main/sessions/*.jsonl
  | "media"              // *.png, *.pdf
  | "log"                // logs/*
  | "other";

export interface BrainStats {
  total_files: number;
  total_size: number;
  consciousness_files: number;
  memory_files: number;
  skills_count: number;
  sessions_count: number;
}

export interface BrainRecord {
  id: string;
  name: string;
  author: string;
  description: string;
  visibility: "public" | "private";
  version: string;
  tags: string;          // JSON array stored as string in SQLite
  file_path: string;
  file_size: number;
  checksum: string;
  created_at: string;
  updated_at: string;
}

export interface MergeRequest {
  brain_a: string;       // brain id or "local" for ~/.openclaw
  brain_b: string;       // brain id
  strategy: MergeStrategy;
}

export type MergeStrategy =
  | "union"              // combine both, no conflict resolution
  | "prefer-a"           // on conflict, keep A
  | "prefer-b"           // on conflict, keep B
  | "manual";            // generate conflict markers for human review

export interface MergeResult {
  id: string;
  brain_a: string;
  brain_b: string;
  strategy: MergeStrategy;
  output_path: string;
  conflicts: MergeConflict[];
  created_at: string;
}

export interface MergeConflict {
  file: string;
  section: string;
  content_a: string;
  content_b: string;
}

// Sanitization rules
export interface SanitizeRule {
  description: string;
  // Files/dirs to completely remove
  remove_paths: string[];
  // JSON fields to redact (dot notation)
  redact_fields: Record<string, RedactPattern[]>;
}

export interface RedactPattern {
  field: string;         // JSON path like "gateway.auth.token"
  replacement: string;   // what to replace with
}

export const DEFAULT_SERVER_URL = "http://localhost:3000";

export const OPENCLAW_HOME = `${process.env.HOME}/.openclaw`;
