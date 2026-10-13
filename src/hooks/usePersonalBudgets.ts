import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cacheGet, cacheSet } from '@/lib/offlineDb';

export interface PersonalBudget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  period: string;
  created_at: string;
  updated_at: string;
}

export const usePersonalBudgets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = `personal_budgets-${user?.id}`;

  const query = useQuery({
    queryKey: ['personal_budgets', user?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = await cacheGet<PersonalBudget[]>(cacheKey);
        return cached ?? [];
      }
      const { data, error } = await supabase
        .from('personal_budgets')
        .select('*')
        .eq('user_id', user!.id)
        .order('category');
      if (error) throw error;
      const result = data as PersonalBudget[];
      cacheSet(cacheKey, result).catch(console.error);
      return result;
    },
    enabled: !!user,
  });

  const upsertBudget = useMutation({
    mutationFn: async ({ category, amount }: { category: string; amount: number }) => {
      // Try update first, then insert (upsert via onConflict)
      const { data, error } = await supabase
        .from('personal_budgets')
        .upsert(
          { user_id: user!.id, category, amount },
          { onConflict: 'user_id,category' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal_budgets'] });
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('personal_budgets')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal_budgets'] });
    },
  });

  return {
    budgets: query.data ?? [],
    isLoading: query.isLoading,
    upsertBudget,
    deleteBudget,
  };
};
