-- Allow authenticated users to delete their own practice sessions
CREATE POLICY "Users delete own sessions" ON public.practice_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
