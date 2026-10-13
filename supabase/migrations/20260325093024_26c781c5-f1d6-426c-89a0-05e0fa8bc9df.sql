
-- Create accounts table
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'wallet',
  color text NOT NULL DEFAULT '#6366f1',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add account_id to transactions (nullable for backward compat)
ALTER TABLE public.transactions ADD COLUMN account_id uuid REFERENCES public.accounts(id);

-- Create default account for all existing users who have profiles
INSERT INTO public.accounts (user_id, name, icon, color, is_default)
SELECT p.user_id, 'Personnel', 'wallet', '#6366f1', true
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.user_id = p.user_id);

-- Link existing transactions to default account
UPDATE public.transactions t
SET account_id = a.id
FROM public.accounts a
WHERE a.user_id = t.user_id AND a.is_default = true AND t.account_id IS NULL;

-- Trigger: auto-create default account when new profile is created
CREATE OR REPLACE FUNCTION public.create_default_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.accounts (user_id, name, icon, color, is_default)
  VALUES (NEW.user_id, 'Personnel', 'wallet', '#6366f1', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_create_account
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_default_account();
