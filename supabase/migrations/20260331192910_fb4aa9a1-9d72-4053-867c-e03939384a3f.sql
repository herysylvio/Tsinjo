
CREATE TABLE public.user_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, name)
);

ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.user_categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.user_categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.user_categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_user_category_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'type must be income or expense';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_user_category_type_trigger
  BEFORE INSERT OR UPDATE ON public.user_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_category_type();
