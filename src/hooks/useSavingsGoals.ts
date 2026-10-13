import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cacheGet, cacheSet } from '@/lib/offlineDb';

export interface SavingsDeposit {
  id: string;
  savings_goal_id: string;
  user_id: string;
  amount: number;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  icon: string;
  color: string;
  deadline: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useSavingsGoals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = `savings_goals-${user?.id}`;
  const depositsCacheKey = `savings_deposits-${user?.id}`;

  const query = useQuery({
    queryKey: ['savings_goals', user?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = await cacheGet<SavingsGoal[]>(cacheKey);
        return cached ?? [];
      }
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const result = data as SavingsGoal[];
      cacheSet(cacheKey, result).catch(console.error);
      return result;
    },
    enabled: !!user,
  });

  const createGoal = useMutation({
    mutationFn: async (goal: {
      name: string;
      target_amount: number;
      icon: string;
      color: string;
      deadline?: string;
      account_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('savings_goals')
        .insert({ ...goal, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savings_goals'] }),
  });

  const depositsQuery = useQuery({
    queryKey: ['savings_deposits', user?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = await cacheGet<SavingsDeposit[]>(depositsCacheKey);
        return cached ?? [];
      }
      const { data, error } = await supabase
        .from('savings_deposits')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const result = data as SavingsDeposit[];
      cacheSet(depositsCacheKey, result).catch(console.error);
      return result;
    },
    enabled: !!user,
  });

  const addAmount = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const goal = query.data?.find(g => g.id === id);
      if (!goal) throw new Error('Goal not found');

      // Update the goal's current_amount
      const { error } = await supabase
        .from('savings_goals')
        .update({ current_amount: Number(goal.current_amount) + amount })
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;

      // Log the deposit
      const { error: depError } = await supabase
        .from('savings_deposits')
        .insert({ savings_goal_id: id, user_id: user!.id, amount });
      if (depError) throw depError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
      queryClient.invalidateQueries({ queryKey: ['savings_deposits'] });
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('savings_goals')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savings_goals'] }),
  });

  return {
    goals: query.data ?? [],
    deposits: depositsQuery.data ?? [],
    isLoading: query.isLoading,
    createGoal,
    addAmount,
    deleteGoal,
  };
};
