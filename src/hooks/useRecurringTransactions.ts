import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TransactionType } from '@/hooks/useTransactions';

export type Frequency =
  | 'daily'
  | 'weekly'
  | 'bimonthly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'yearly';

export type ConfirmationMode = 'auto' | 'manual';

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  frequency: Frequency;
  next_due_date: string;
  is_active: boolean;
  confirmation_mode: ConfirmationMode;
  created_at: string;
}

export interface RecurringTransactionInsert {
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  frequency: Frequency;
  next_due_date: string;
  account_id?: string;
  confirmation_mode?: ConfirmationMode;
}

export const useRecurringTransactions = (accountId?: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['recurring_transactions', user?.id, accountId ?? 'all'],
    queryFn: async () => {
      let req = supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('next_due_date', { ascending: true });
      if (accountId) req = req.eq('account_id', accountId);
      const { data, error } = await req;
      if (error) throw error;
      return data as unknown as RecurringTransaction[];
    },
    enabled: !!user,
  });

  const addRecurring = useMutation({
    mutationFn: async (rec: RecurringTransactionInsert) => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .insert({ ...rec, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Trigger immediate processing if next_due_date is in the past or today
      try {
        const today = new Date().toISOString().split('T')[0];
        if (rec.next_due_date <= today) {
          await supabase.functions.invoke('process-recurring', {
            body: { recurring_id: data.id },
          });
        }
      } catch (e) {
        console.error('process-recurring invoke failed', e);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recurring_pending'] });
    },
  });

  const updateRecurring = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RecurringTransactionInsert> & { id: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
    },
  });

  const deleteRecurring = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recurring_pending'] });
    },
  });

  return {
    recurringTransactions: query.data ?? [],
    isLoading: query.isLoading,
    addRecurring,
    updateRecurring,
    deleteRecurring,
  };
};
