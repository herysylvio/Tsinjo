
-- Add editor to family_role enum
ALTER TYPE family_role ADD VALUE IF NOT EXISTS 'editor';

-- Create family_shared_accounts table
CREATE TABLE public.family_shared_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, user_id, account_id)
);

-- Enable RLS
ALTER TABLE public.family_shared_accounts ENABLE ROW LEVEL SECURITY;

-- Members can view all shared accounts in their family
CREATE POLICY "Family members can view shared accounts"
ON public.family_shared_accounts
FOR SELECT
TO authenticated
USING (is_family_member(auth.uid(), family_id));

-- Users can manage their own shared accounts
CREATE POLICY "Users can share own accounts"
ON public.family_shared_accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND is_family_member(auth.uid(), family_id));

CREATE POLICY "Users can unshare own accounts"
ON public.family_shared_accounts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_shared_accounts;
