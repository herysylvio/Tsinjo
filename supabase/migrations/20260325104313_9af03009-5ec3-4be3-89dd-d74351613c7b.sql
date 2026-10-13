
CREATE TABLE public.conversation_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversation titles"
  ON public.conversation_titles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversation titles"
  ON public.conversation_titles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own conversation titles"
  ON public.conversation_titles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
