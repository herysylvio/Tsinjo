-- Create a function to atomically create a family and add the creator as admin
CREATE OR REPLACE FUNCTION public.create_family_with_admin(_name text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family_id uuid;
BEGIN
  INSERT INTO public.families (name, created_by)
  VALUES (_name, _user_id)
  RETURNING id INTO _family_id;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (_family_id, _user_id, 'admin');

  RETURN _family_id;
END;
$$;