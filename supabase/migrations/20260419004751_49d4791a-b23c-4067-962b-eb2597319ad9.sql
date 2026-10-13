-- Table user_reminders
CREATE TABLE public.user_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily_entry', 'recurring_due', 'weekly_recap', 'inactivity')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  time TEXT NOT NULL DEFAULT '20:00',
  timezone TEXT NOT NULL DEFAULT 'Indian/Antananarivo',
  quiet_start TEXT NOT NULL DEFAULT '22:00',
  quiet_end TEXT NOT NULL DEFAULT '07:00',
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type)
);

ALTER TABLE public.user_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reminders" ON public.user_reminders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reminders" ON public.user_reminders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reminders" ON public.user_reminders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reminders" ON public.user_reminders
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_user_reminders_updated_at
  BEFORE UPDATE ON public.user_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table push_subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own push subs" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own push subs" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own push subs" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX idx_user_reminders_enabled ON public.user_reminders(enabled) WHERE enabled = true;

-- Seed reminders for new users
CREATE OR REPLACE FUNCTION public.seed_user_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_reminders (user_id, type, enabled, time) VALUES
    (NEW.id, 'daily_entry', true, '20:00'),
    (NEW.id, 'recurring_due', false, '09:00'),
    (NEW.id, 'weekly_recap', false, '19:00'),
    (NEW.id, 'inactivity', false, '18:00')
  ON CONFLICT (user_id, type) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_seed_reminders
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_user_reminders();

-- Backfill existing users
INSERT INTO public.user_reminders (user_id, type, enabled, time)
SELECT id, 'daily_entry', true, '20:00' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;
INSERT INTO public.user_reminders (user_id, type, enabled, time)
SELECT id, 'recurring_due', false, '09:00' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;
INSERT INTO public.user_reminders (user_id, type, enabled, time)
SELECT id, 'weekly_recap', false, '19:00' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;
INSERT INTO public.user_reminders (user_id, type, enabled, time)
SELECT id, 'inactivity', false, '18:00' FROM auth.users
ON CONFLICT (user_id, type) DO NOTHING;

-- Enable cron extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;