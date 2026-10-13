import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserCategory {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  name: string;
  account_id: string | null;
  created_at: string;
}

export const useUserCategories = (type?: 'income' | 'expense', accountId?: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['user_categories', user?.id, type, accountId],
    queryFn: async () => {
      let query = supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', user!.id)
        .order('name');

      if (type) {
        query = query.eq('type', type);
      }

      if (accountId) {
        // Show categories for this account + global ones (account_id is null)
        query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UserCategory[];
    },
    enabled: !!user,
  });

  const addCategory = useMutation({
    mutationFn: async ({ name, type: catType, account_id }: { name: string; type: 'income' | 'expense'; account_id?: string | null }) => {
      const { data, error } = await supabase
        .from('user_categories')
        .insert({ user_id: user!.id, name, type: catType, account_id: account_id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as UserCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_categories'] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_categories'] });
    },
  });

  return {
    categories: categoriesQuery.data ?? [],
    isLoading: categoriesQuery.isLoading,
    addCategory,
    deleteCategory,
  };
};
