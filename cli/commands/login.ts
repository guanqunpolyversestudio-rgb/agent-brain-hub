import http from "http";
import { URL } from "url";
import { createClient } from "@supabase/supabase-js";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../shared/supabase.js";

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || ".";
const CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? path.join(process.env.XDG_CONFIG_HOME, "openclaw_brain")
  : path.join(HOME_DIR, ".config", "openclaw_brain");
const TOKEN_PATH = path.join(CONFIG_DIR, "auth.json");
const LEGACY_TOKEN_PATH = path.join(HOME_DIR, ".brain-hub", "auth.json");

export interface LoginOptions {
  server?: string;
}

function ensureTokenPath(): string {
  if (!fs.existsSync(TOKEN_PATH) && fs.existsSync(LEGACY_TOKEN_PATH)) {
    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.copyFileSync(LEGACY_TOKEN_PATH, TOKEN_PATH);
  }
  return TOKEN_PATH;
}

/**
 * Opens browser for Google OAuth login.
 * Starts a local HTTP server to receive the callback with tokens.
 */
export async function loginCommand(_opts: LoginOptions): Promise<void> {
  console.log(chalk.blue("=== Brain Hub Login ==="));
  console.log();

  const PORT = 8976;
  const REDIRECT_URL = `http://localhost:${PORT}/callback`;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Generate OAuth URL
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.log(chalk.red("Failed to generate login URL:"), error?.message);
    return;
  }

  // Start local server to catch the callback
  const tokenPromise = new Promise<{ access_token: string; refresh_token: string } | null>(
    (resolve) => {
      let settled = false;
      let timeoutId: NodeJS.Timeout | null = null;

      const finish = (tokens: { access_token: string; refresh_token: string } | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        server.close();
        resolve(tokens);
      };

      const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url || "/", `http://localhost:${PORT}`);

        if (reqUrl.pathname === "/callback") {
          // Supabase redirects with tokens in the hash fragment.
          // Browsers don't send hash to server, so we serve a page that extracts it.
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`<!DOCTYPE html>
<html>
<head><title>Brain Hub Login</title></head>
<body style="background:#0a0e17;color:#e2e8f0;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0">
<div style="text-align:center">
  <div id="loading">
    <h2>Completing login...</h2>
  </div>
  <div id="done" style="display:none">
    <h2 style="color:#10b981">Login successful!</h2>
    <p style="color:#94a3b8">You can close this tab and return to the terminal.</p>
  </div>
</div>
<script>
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token) {
    fetch('/token', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({access_token, refresh_token})
    }).then(() => {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('done').style.display = 'block';
    });
  } else {
    document.getElementById('loading').innerHTML = '<h2 style="color:#ef4444">Login failed</h2><p style="color:#94a3b8">No token received. Please try again.</p>';
  }
</script>
</body></html>`);
        } else if (reqUrl.pathname === "/token" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const tokens = JSON.parse(body);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end('{"ok":true}');
              finish(tokens);
            } catch {
              res.writeHead(400);
              res.end("Bad request");
            }
          });
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      });

      server.listen(PORT, () => {
        // Open browser
        const openCmd =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";

        import("child_process").then(({ exec }) => {
          exec(`${openCmd} "${data.url}"`);
        });

        console.log(chalk.yellow("Opening browser for Google login..."));
        console.log(chalk.gray(`If the browser doesn't open, visit:`));
        console.log(chalk.gray(data.url));
        console.log();
        console.log(chalk.gray("Waiting for login..."));
      });

      // Timeout after 2 minutes
      timeoutId = setTimeout(() => {
        finish(null);
      }, 120000);
    }
  );

  const tokens = await tokenPromise;

  if (!tokens?.access_token) {
    console.log(chalk.red("Login timed out or failed."));
    return;
  }

  // Get user info
  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  });
  const { data: { user } } = await authedClient.auth.getUser(tokens.access_token);

  // Save tokens locally
  const tokenPath = ensureTokenPath();
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(
    tokenPath,
    JSON.stringify(
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.user_metadata?.full_name,
              avatar: user.user_metadata?.avatar_url,
            }
          : null,
        saved_at: new Date().toISOString(),
      },
      null,
      2
    ) + "\n"
  );

  console.log();
  console.log(chalk.green("Logged in successfully!"));
  if (user) {
  console.log(
      chalk.gray(
        `  ${user.user_metadata?.full_name || user.email} (${user.id.slice(0, 8)}...)`
      )
    );
  }
  console.log(chalk.gray(`  Token saved to ${tokenPath}`));
}

/**
 * Loads saved auth token. Returns null if not logged in.
 */
export function loadAuthToken(): string | null {
  const tokenPath = ensureTokenPath();
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    return data.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Loads saved user info.
 */
export function loadAuthUser(): { id: string; email: string; name: string } | null {
  const tokenPath = ensureTokenPath();
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
    return data.user || null;
  } catch {
    return null;
  }
}

export async function logoutCommand(): Promise<void> {
  const removedPaths: string[] = [];
  for (const tokenPath of [TOKEN_PATH, LEGACY_TOKEN_PATH]) {
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
      removedPaths.push(tokenPath);
    }
  }

  if (removedPaths.length > 0) {
    console.log(chalk.green("Logged out. Token removed."));
    for (const tokenPath of removedPaths) {
      console.log(chalk.gray(`  Removed ${tokenPath}`));
    }
  } else {
    console.log(chalk.gray("Not logged in."));
  }
}

export async function whoamiCommand(): Promise<void> {
  const user = loadAuthUser();
  const token = loadAuthToken();
  if (!user || !token) {
    console.log(chalk.gray("Not logged in. Run: openclaw_brain login"));
    return;
  }
  console.log(chalk.blue("=== Current User ==="));
  console.log(`  Name:  ${user.name || "N/A"}`);
  console.log(`  Email: ${user.email || "N/A"}`);
  console.log(`  ID:    ${user.id}`);
}
