-- Add confirmation_mode column to recurring_transactions
ALTER TABLE public.recurring_transactions
ADD COLUMN IF NOT EXISTS confirmation_mode text NOT NULL DEFAULT 'manual'
CHECK (confirmation_mode IN ('auto', 'manual'));

-- Create recurring_pending table
CREATE TABLE IF NOT EXISTS public.recurring_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL,
  user_id uuid NOT NULL,
  account_id uuid,
  type public.transaction_type NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL,
  description text,
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_pending_user ON public.recurring_pending(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_pending_recurring ON public.recurring_pending(recurring_id);

ALTER TABLE public.recurring_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending recurring"
ON public.recurring_pending FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending recurring"
ON public.recurring_pending FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pending recurring"
ON public.recurring_pending FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
