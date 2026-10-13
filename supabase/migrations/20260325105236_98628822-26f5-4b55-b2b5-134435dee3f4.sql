
CREATE POLICY "Users can update own conversation titles"
  ON public.conversation_titles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
