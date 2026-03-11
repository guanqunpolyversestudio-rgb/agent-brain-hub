/**
 * Defines what to remove and what to redact when exporting a brain.
 */

// Directories and files to completely skip during copy
export const SKIP_PATHS = [
  "browser",                          // Chromium runtime cache (68MB, auto-regenerated)
  "credentials",                      // WhatsApp session keys, pre-keys
  "identity",                         // Device Ed25519 keys + auth tokens
  "agents/main/agent/auth.json",      // OAuth tokens
  "agents/main/agent/auth-profiles.json", // API keys + tokens
  "completions",                      // Shell completions (env-specific)
  "delivery-queue",                   // Pending messages (personal)
  "update-check.json",                // Version check state
  "exec-approvals.json",              // Local exec approval rules
  "media",                            // Browser-captured PDFs (personal)
  ".git",                             // Git internals in workspace
  "workspace/.git",
  "workspace/.clawhub",               // File locks
  "workspace/.openclaw",              // Local workspace state
];

// File extensions to skip (binary blobs that aren't useful for brain sharing)
export const SKIP_EXTENSIONS = [
  ".sqlite",    // Binary DB - we export a dump instead
  ".pdf",
];

// Patterns to redact in JSON files
export const JSON_REDACTIONS: Record<string, RedactionRule[]> = {
  "openclaw.json": [
    { path: "gateway.auth.token", replacement: "<REDACTED_TOKEN>" },
    { path: "channels.whatsapp.allowFrom", replacement: ["+1XXXXXXXXXX"] },
  ],
  "cron/jobs.json": [
    // Redact any phone numbers or tokens found in cron jobs
  ],
};

// Patterns to redact in any text file (regex)
export const TEXT_REDACTIONS = [
  { pattern: /\+1\d{10}/g, replacement: "+1XXXXXXXXXX" },
  { pattern: /\+86\d{11}/g, replacement: "+86XXXXXXXXXXX" },
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: "<REDACTED_API_KEY>" },
  { pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, replacement: "<REDACTED_JWT>" },
  { pattern: /[a-f0-9]{48,}/g, replacement: "<REDACTED_HEX_TOKEN>" },
];

export interface RedactionRule {
  path: string;
  replacement: unknown;
}
