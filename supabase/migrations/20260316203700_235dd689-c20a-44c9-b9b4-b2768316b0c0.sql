-- Add invite_code to families
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Create function to generate random invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.families WHERE invite_code = code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Set default invite_code for new families
ALTER TABLE public.families ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();

-- Update existing families without invite codes
UPDATE public.families SET invite_code = public.generate_invite_code() WHERE invite_code IS NULL;

-- Make invite_code NOT NULL after populating
ALTER TABLE public.families ALTER COLUMN invite_code SET NOT NULL;

-- Create family_budgets table
CREATE TABLE IF NOT EXISTS public.family_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, category)
);

ALTER TABLE public.family_budgets ENABLE ROW LEVEL SECURITY;

-- Create permission function for family members
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id AND role = 'admin'
  )
$$;

-- Fix broken RLS policies on families
DROP POLICY IF EXISTS "Family members can view their family" ON public.families;
CREATE POLICY "Family members can view their family" ON public.families
  FOR SELECT TO authenticated
  USING (public.is_family_member(auth.uid(), id));

DROP POLICY IF EXISTS "Family admins can update their family" ON public.families;
CREATE POLICY "Family admins can update their family" ON public.families
  FOR UPDATE TO authenticated
  USING (public.is_family_admin(auth.uid(), id));

-- Fix broken RLS policies on family_members
DROP POLICY IF EXISTS "Family members can view fellow members" ON public.family_members;
CREATE POLICY "Family members can view fellow members" ON public.family_members
  FOR SELECT TO authenticated
  USING (public.is_family_member(auth.uid(), family_id));

DROP POLICY IF EXISTS "Family admins can update members" ON public.family_members;
CREATE POLICY "Family admins can update members" ON public.family_members
  FOR UPDATE TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id));

DROP POLICY IF EXISTS "Family admins can remove members" ON public.family_members;
CREATE POLICY "Family admins can remove members" ON public.family_members
  FOR DELETE TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id) OR auth.uid() = user_id);

-- RLS policies for family_budgets
CREATE POLICY "Family members can view budgets" ON public.family_budgets
  FOR SELECT TO authenticated
  USING (public.is_family_member(auth.uid(), family_id));

CREATE POLICY "Family admins can manage budgets" ON public.family_budgets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_family_admin(auth.uid(), family_id));

CREATE POLICY "Family admins can update budgets" ON public.family_budgets
  FOR UPDATE TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id));

CREATE POLICY "Family admins can delete budgets" ON public.family_budgets
  FOR DELETE TO authenticated
  USING (public.is_family_admin(auth.uid(), family_id));

-- Enable realtime for family-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;