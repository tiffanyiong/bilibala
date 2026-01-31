-- Add transcript_lang_mismatch flag to cached_analyses
-- Indicates when the transcript language doesn't match the requested target language
ALTER TABLE cached_analyses
  ADD COLUMN IF NOT EXISTS transcript_lang_mismatch boolean NOT NULL DEFAULT false;
