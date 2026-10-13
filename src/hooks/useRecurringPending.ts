import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TransactionType } from '@/hooks/useTransactions';

export interface RecurringPending {
  id: string;
  recurring_id: string;
  user_id: string;
  account_id: string | null;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  due_date: string;
  created_at: string;
}

export const useRecurringPending = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['recurring_pending', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_pending')
        .select('*')
        .eq('user_id', user!.id)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as unknown as RecurringPending[];
    },
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['recurring_pending'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  const confirmPending = useMutation({
    mutationFn: async (pending: RecurringPending) => {
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: pending.user_id,
        account_id: pending.account_id,
        type: pending.type,
        amount: pending.amount,
        category: pending.category,
        description: pending.description,
        transaction_date: pending.due_date,
      });
      if (insertError) throw insertError;
      const { error: deleteError } = await supabase
        .from('recurring_pending')
        .delete()
        .eq('id', pending.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: invalidate,
  });

  const dismissPending = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_pending').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const confirmAll = useMutation({
    mutationFn: async () => {
      const items = query.data ?? [];
      if (items.length === 0) return;
      const rows = items.map((p) => ({
        user_id: p.user_id,
        account_id: p.account_id,
        type: p.type,
        amount: p.amount,
        category: p.category,
        description: p.description,
        transaction_date: p.due_date,
      }));
      const { error: insertError } = await supabase.from('transactions').insert(rows);
      if (insertError) throw insertError;
      const { error: deleteError } = await supabase
        .from('recurring_pending')
        .delete()
        .in('id', items.map((i) => i.id));
      if (deleteError) throw deleteError;
    },
    onSuccess: invalidate,
  });

  return {
    pending: query.data ?? [],
    isLoading: query.isLoading,
    confirmPending,
    dismissPending,
    confirmAll,
  };
};
