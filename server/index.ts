import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import brainsRouter from "./routes/brains.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../shared/supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// Expose Supabase config to frontend (public keys only)
app.get("/api/config", (_req, res) => {
  res.json({
    supabase_url: SUPABASE_URL,
    supabase_anon_key: SUPABASE_ANON_KEY,
  });
});

// Routes
app.use("/brains", brainsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    name: "OpenClaw Brain Hub",
    version: "0.1.0",
    status: "running",
  });
});

app.listen(PORT, () => {
  console.log(`Brain Hub server running on http://localhost:${PORT}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
});

export default app;
