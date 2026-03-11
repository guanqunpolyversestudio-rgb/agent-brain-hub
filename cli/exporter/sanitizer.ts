import fs from "fs";
import path from "path";
import { JSON_REDACTIONS, TEXT_REDACTIONS } from "../../shared/sanitize-rules.js";
import type { BrainFile } from "../../shared/types.js";

/**
 * Sanitizes files in the temp directory by redacting sensitive information.
 * Operates on the copied files, never touches originals.
 */
export function sanitizeBrain(tmpDir: string, files: BrainFile[]): void {
  for (const file of files) {
    const fullPath = path.join(tmpDir, file.path);
    if (!fs.existsSync(fullPath)) continue;

    const ext = path.extname(file.path).toLowerCase();

    if (ext === ".json" || ext === ".jsonl") {
      sanitizeJsonFile(fullPath, file);
    } else if (ext === ".md" || ext === ".txt" || ext === ".ts" || ext === ".sh") {
      sanitizeTextFile(fullPath, file);
    }
  }
}

function sanitizeJsonFile(fullPath: string, file: BrainFile): void {
  const content = fs.readFileSync(fullPath, "utf-8");
  const basename = file.path;

  // Check if there are specific redaction rules for this file
  const rules = JSON_REDACTIONS[basename];
  if (rules && rules.length > 0) {
    try {
      const json = JSON.parse(content);
      let modified = false;

      for (const rule of rules) {
        if (setNestedValue(json, rule.path, rule.replacement)) {
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, JSON.stringify(json, null, 2) + "\n");
        file.sanitized = true;
      }
    } catch {
      // If JSON parse fails, fall through to text sanitization
    }
  }

  // Also apply text-level redactions to JSON files
  sanitizeTextFile(fullPath, file);
}

function sanitizeTextFile(fullPath: string, file: BrainFile): void {
  let content = fs.readFileSync(fullPath, "utf-8");
  let modified = false;

  for (const rule of TEXT_REDACTIONS) {
    const newContent = content.replace(rule.pattern, rule.replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content);
    file.sanitized = true;
  }
}

/**
 * Sets a value at a dot-notation path in an object.
 * Returns true if the path existed and was modified.
 */
function setNestedValue(obj: Record<string, unknown>, dotPath: string, value: unknown): boolean {
  const parts = dotPath.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== "object" || current[part] === null) {
      return false;
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (current[lastPart] !== undefined) {
    current[lastPart] = value;
    return true;
  }
  return false;
}
