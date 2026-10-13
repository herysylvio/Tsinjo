import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'expired' | 'pending';
  starts_at: string | null;
  expires_at: string | null;
  payment_method: 'mvola' | 'orange_money' | 'license_code' | null;
  payment_reference: string | null;
  created_at: string;
}

export const PLANS = [
  { key: 'monthly' as const, duration: '1 mois', price: 14500, pricePerMonth: 14500 },
  { key: 'quarterly' as const, duration: '3 mois', price: 39000, pricePerMonth: 13000 },
  { key: 'semi_annual' as const, duration: '6 mois', price: 69000, pricePerMonth: 11500 },
  { key: 'annual' as const, duration: '12 mois', price: 98000, pricePerMonth: 8167 },
] as const;

export function useSubscription() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!user,
  });

  const isPremium = !!subscription && subscription.status === 'active' && 
    !!subscription.expires_at && new Date(subscription.expires_at) > new Date();

  const remainingDays = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const activateLicenseCode = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('activate_license_code', {
        _code: code,
        _user_id: user!.id,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string; plan?: string; expires_at?: string };
      if (!result.success) {
        throw new Error(result.error || 'activation_failed');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: t('premium.activated') });
    },
    onError: (error: Error) => {
      const msg = error.message === 'invalid_code' 
        ? t('premium.invalid_code') 
        : t('premium.activation_error');
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const requestPayment = useMutation({
    mutationFn: async ({ plan, method, reference }: { plan: SubscriptionPlan; method: 'mvola' | 'orange_money'; reference: string }) => {
      const { error } = await supabase.from('subscriptions').insert({
        user_id: user!.id,
        plan,
        status: 'pending',
        payment_method: method,
        payment_reference: reference,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: t('premium.payment_sent') });
    },
    onError: () => {
      toast({ title: t('premium.payment_error'), variant: 'destructive' });
    },
  });

  return {
    subscription,
    isPremium,
    remainingDays,
    isLoading,
    activateLicenseCode,
    requestPayment,
  };
}
