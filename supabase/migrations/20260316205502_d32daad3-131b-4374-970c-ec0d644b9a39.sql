ALTER TABLE public.family_budgets ADD CONSTRAINT family_budgets_family_category_unique UNIQUE (family_id, category);
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_budgets;