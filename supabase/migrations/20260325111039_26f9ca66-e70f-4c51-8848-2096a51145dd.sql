
CREATE TABLE public.personal_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

ALTER TABLE public.personal_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal budgets"
  ON public.personal_budgets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personal budgets"
  ON public.personal_budgets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personal budgets"
  ON public.personal_budgets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own personal budgets"
  ON public.personal_budgets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_personal_budgets_updated_at
  BEFORE UPDATE ON public.personal_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
