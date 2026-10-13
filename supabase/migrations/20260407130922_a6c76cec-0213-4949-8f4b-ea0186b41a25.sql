
-- Enum for subscription plans
CREATE TYPE public.subscription_plan AS ENUM ('monthly', 'quarterly', 'semi_annual', 'annual');

-- Enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'pending');

-- Enum for payment method
CREATE TYPE public.payment_method AS ENUM ('mvola', 'orange_money', 'license_code');

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'pending',
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  payment_method payment_method,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- License codes table
CREATE TABLE public.license_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  plan subscription_plan NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  batch_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.license_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can see/manage license codes
CREATE POLICY "Admins can view license codes" ON public.license_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert license codes" ON public.license_codes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update license codes" ON public.license_codes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete license codes" ON public.license_codes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RPC to activate a license code (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.activate_license_code(_code TEXT, _user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _license RECORD;
  _duration INTERVAL;
  _plan_name subscription_plan;
  _sub_id UUID;
BEGIN
  -- Find and lock the code
  SELECT * INTO _license
  FROM public.license_codes
  WHERE code = upper(trim(_code)) AND is_used = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  _plan_name := _license.plan;

  -- Determine duration
  CASE _plan_name
    WHEN 'monthly' THEN _duration := INTERVAL '1 month';
    WHEN 'quarterly' THEN _duration := INTERVAL '3 months';
    WHEN 'semi_annual' THEN _duration := INTERVAL '6 months';
    WHEN 'annual' THEN _duration := INTERVAL '1 year';
  END CASE;

  -- Mark code as used
  UPDATE public.license_codes
  SET is_used = true, used_by = _user_id, used_at = now()
  WHERE id = _license.id;

  -- Create or extend subscription
  INSERT INTO public.subscriptions (user_id, plan, status, starts_at, expires_at, payment_method, payment_reference)
  VALUES (_user_id, _plan_name, 'active', now(), now() + _duration, 'license_code', _license.code)
  RETURNING id INTO _sub_id;

  RETURN jsonb_build_object('success', true, 'plan', _plan_name, 'expires_at', (now() + _duration)::text);
END;
$$;

-- RPC to generate license codes (admin only, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.generate_license_codes(_plan subscription_plan, _count INTEGER, _batch TEXT, _admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _i INTEGER;
  _code TEXT;
  _exists BOOLEAN;
  _codes TEXT[] := '{}';
BEGIN
  -- Check admin
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  FOR _i IN 1.._count LOOP
    LOOP
      _code := 'TSINJO-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 3)) || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 3));
      SELECT EXISTS(SELECT 1 FROM public.license_codes WHERE code = _code) INTO _exists;
      IF NOT _exists THEN EXIT; END IF;
    END LOOP;

    INSERT INTO public.license_codes (code, plan, created_by, batch_name)
    VALUES (_code, _plan, _admin_id, _batch);

    _codes := array_append(_codes, _code);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'codes', to_jsonb(_codes));
END;
$$;
