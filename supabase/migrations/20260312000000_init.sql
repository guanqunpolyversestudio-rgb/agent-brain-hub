-- Brain registry table
CREATE TABLE IF NOT EXISTS brains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  author      TEXT NOT NULL DEFAULT '',
  user_id     UUID REFERENCES auth.users(id),
  description TEXT NOT NULL DEFAULT '',
  visibility  TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  version     TEXT NOT NULL DEFAULT '1.0.0',
  tags        JSONB NOT NULL DEFAULT '[]',
  file_path   TEXT NOT NULL,
  file_size   BIGINT NOT NULL DEFAULT 0,
  checksum    TEXT NOT NULL DEFAULT '',
  manifest    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Merge history
CREATE TABLE IF NOT EXISTS merge_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_a     UUID NOT NULL REFERENCES brains(id),
  brain_b     UUID NOT NULL REFERENCES brains(id),
  user_id     UUID REFERENCES auth.users(id),
  strategy    TEXT NOT NULL DEFAULT 'manual',
  result_path TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brains_visibility ON brains(visibility);
CREATE INDEX IF NOT EXISTS idx_brains_author ON brains(author);
CREATE INDEX IF NOT EXISTS idx_brains_user_id ON brains(user_id);
CREATE INDEX IF NOT EXISTS idx_brains_created ON brains(created_at DESC);

-- RLS policies
ALTER TABLE brains ENABLE ROW LEVEL SECURITY;

-- Anyone can read public brains
CREATE POLICY "Public brains are viewable by everyone"
  ON brains FOR SELECT
  USING (visibility = 'public');

-- Authenticated users can read their own private brains
CREATE POLICY "Users can view own brains"
  ON brains FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert brains
CREATE POLICY "Authenticated users can create brains"
  ON brains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own brains
CREATE POLICY "Users can update own brains"
  ON brains FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own brains
CREATE POLICY "Users can delete own brains"
  ON brains FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for brain tarballs
INSERT INTO storage.buckets (id, name, public)
VALUES ('brains', 'brains', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public brain downloads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brains');

CREATE POLICY "Authenticated users can upload brains"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brains' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own brain files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'brains' AND auth.uid()::text = (storage.foldername(name))[1]);
