-- Add is_favorited column to practice_sessions
ALTER TABLE public.practice_sessions
  ADD COLUMN is_favorited BOOLEAN NOT NULL DEFAULT false;

-- Allow authenticated users to update their own practice sessions (for toggling favorite)
CREATE POLICY "Users update own sessions" ON public.practice_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
