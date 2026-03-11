import { Router, type Request, type Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { createHash } from "crypto";
import { getServiceClient } from "../../shared/supabase.js";
import type { BrainManifest } from "../../shared/types.js";

const upload = multer({ dest: os.tmpdir() });
const router = Router();

// POST /brains - Upload a brain
router.post("/", upload.single("brain"), async (req: Request, res: Response) => {
  try {
    const manifestStr = req.body?.manifest;
    if (!manifestStr) {
      res.status(400).json({ error: "Missing manifest" });
      return;
    }

    const manifest: BrainManifest = JSON.parse(manifestStr);
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "Missing brain tarball" });
      return;
    }

    const supabase = getServiceClient();

    // Read file and compute checksum
    const fileBuffer = fs.readFileSync(file.path);
    const checksum = createHash("sha256").update(fileBuffer).digest("hex");

    // Upload tarball to Supabase Storage
    const storagePath = `${manifest.id}/${manifest.id}.tar.gz`;
    const { error: uploadError } = await supabase.storage
      .from("brains")
      .upload(storagePath, fileBuffer, {
        contentType: "application/gzip",
        upsert: true,
      });

    // Clean up temp file
    fs.unlinkSync(file.path);

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      res.status(500).json({ error: "Failed to upload brain file" });
      return;
    }

    // Extract user_id from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Insert record into database
    const { error: dbError } = await supabase.from("brains").insert({
      id: manifest.id,
      name: manifest.name,
      author: manifest.author,
      user_id: userId,
      description: manifest.description,
      visibility: manifest.visibility,
      version: manifest.version,
      tags: manifest.tags,
      file_path: storagePath,
      file_size: fileBuffer.length,
      checksum,
      manifest,
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
      // Try to clean up uploaded file
      await supabase.storage.from("brains").remove([storagePath]);
      res.status(500).json({ error: "Failed to save brain record" });
      return;
    }

    res.status(201).json({
      id: manifest.id,
      message: "Brain uploaded successfully",
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// GET /brains - List brains
router.get("/", async (req: Request, res: Response) => {
  const supabase = getServiceClient();
  const { author, tag } = req.query;

  let query = supabase
    .from("brains")
    .select("*")
    .eq("visibility", "public")
    .order("created_at", { ascending: false });

  if (author) {
    query = query.eq("author", author as string);
  }

  if (tag) {
    query = query.contains("tags", [tag as string]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("List error:", error);
    res.status(500).json({ error: "Failed to list brains" });
    return;
  }

  // Convert tags from JSONB array to JSON string for backward compat with CLI
  const brains = (data || []).map((b) => ({
    ...b,
    tags: JSON.stringify(b.tags || []),
  }));

  res.json(brains);
});

// GET /brains/:id - Get brain details
router.get("/:id", async (req: Request, res: Response) => {
  const supabase = getServiceClient();

  const { data: brain, error } = await supabase
    .from("brains")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error || !brain) {
    res.status(404).json({ error: "Brain not found" });
    return;
  }

  res.json({
    ...brain,
    tags: JSON.stringify(brain.tags || []),
    manifest: brain.manifest,
    download_url: `/brains/${brain.id}/download`,
  });
});

// GET /brains/:id/download - Download brain tarball
router.get("/:id/download", async (req: Request, res: Response) => {
  const supabase = getServiceClient();

  const { data: brain, error } = await supabase
    .from("brains")
    .select("id, file_path")
    .eq("id", req.params.id)
    .single();

  if (error || !brain) {
    res.status(404).json({ error: "Brain not found" });
    return;
  }

  // Get public URL from Supabase Storage
  const { data } = supabase.storage
    .from("brains")
    .getPublicUrl(brain.file_path);

  res.redirect(data.publicUrl);
});

// DELETE /brains/:id - Delete a brain
router.delete("/:id", async (req: Request, res: Response) => {
  const supabase = getServiceClient();

  const { data: brain, error } = await supabase
    .from("brains")
    .select("id, file_path")
    .eq("id", req.params.id)
    .single();

  if (error || !brain) {
    res.status(404).json({ error: "Brain not found" });
    return;
  }

  // Remove from storage
  await supabase.storage.from("brains").remove([brain.file_path]);

  // Remove from DB
  await supabase.from("brains").delete().eq("id", brain.id);

  res.json({ message: "Brain deleted" });
});

export default router;
