import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.SUPABASE_URL || "https://iqmrbtithmvliztlnqgs.supabase.co";
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxbXJidGl0aG12bGl6dGxucWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTg1MzAsImV4cCI6MjA4ODgzNDUzMH0.0R7rn6CHhvRRy_CiB5GWDzq7ZJ5JdM_NBQbX7csu5FY";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxbXJidGl0aG12bGl6dGxucWdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1ODUzMCwiZXhwIjoyMDg4ODM0NTMwfQ.XolssAK4QZB0DzOXpt-kmZjk_7xVkGyXKAO9T-f89KI";

/** Server-side client with service_role - bypasses RLS */
export function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/** Client-side / anon client - respects RLS */
export function getAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** Create a client with user's access token for authenticated operations */
export function getUserClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
