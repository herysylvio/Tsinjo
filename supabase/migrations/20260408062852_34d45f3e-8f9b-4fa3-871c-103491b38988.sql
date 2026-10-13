
-- Drop old family_shared_accounts table
DROP TABLE IF EXISTS public.family_shared_accounts;

-- Create account_members table
CREATE TABLE public.account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, user_id)
);

-- Enable RLS
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is account owner
CREATE OR REPLACE FUNCTION public.is_account_owner(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = _account_id AND user_id = _user_id
  )
$$;

-- Security definer function to check if user is account member
CREATE OR REPLACE FUNCTION public.is_account_member(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = _account_id AND user_id = _user_id
  )
$$;

-- Security definer function to get account member role
CREATE OR REPLACE FUNCTION public.get_account_member_role(_user_id uuid, _account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.account_members
  WHERE account_id = _account_id AND user_id = _user_id
  LIMIT 1
$$;

-- RLS: Account owner can manage members
CREATE POLICY "Account owners can view members"
  ON public.account_members FOR SELECT
  TO authenticated
  USING (public.is_account_owner(auth.uid(), account_id) OR auth.uid() = user_id);

CREATE POLICY "Account owners can add members"
  ON public.account_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_account_owner(auth.uid(), account_id));

CREATE POLICY "Account owners can update members"
  ON public.account_members FOR UPDATE
  TO authenticated
  USING (public.is_account_owner(auth.uid(), account_id));

CREATE POLICY "Account owners or members can remove"
  ON public.account_members FOR DELETE
  TO authenticated
  USING (public.is_account_owner(auth.uid(), account_id) OR auth.uid() = user_id);

-- Allow account members to SELECT accounts they are members of
CREATE POLICY "Account members can view shared accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_account_member(auth.uid(), id));

-- Allow account members to SELECT transactions of shared accounts
CREATE POLICY "Account members can view shared transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));

-- Allow editors to INSERT transactions on shared accounts
CREATE POLICY "Account editors can insert transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.get_account_member_role(auth.uid(), account_id) = 'editor');

-- Enable realtime for account_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_members;
