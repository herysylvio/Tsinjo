
CREATE TABLE public.savings_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_goal_id uuid NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.savings_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deposits" ON public.savings_deposits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deposits" ON public.savings_deposits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deposits" ON public.savings_deposits
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
