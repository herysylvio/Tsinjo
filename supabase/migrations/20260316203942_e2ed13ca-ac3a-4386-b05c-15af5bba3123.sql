-- Remove the overly broad SELECT policy
DROP POLICY IF EXISTS "Anyone can lookup family by invite code" ON public.families;

-- Instead, the join-by-code logic should use a security definer function
CREATE OR REPLACE FUNCTION public.get_family_id_by_invite_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.families WHERE invite_code = upper(trim(_code)) LIMIT 1
$$;