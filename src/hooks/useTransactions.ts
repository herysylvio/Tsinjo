import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cacheGet, cacheSet, addToSyncQueue } from '@/lib/offlineDb';

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  created_at: string;
  _offline?: boolean;
}

export interface TransactionInsert {
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  transaction_date?: string;
  receipt_url?: string;
}

export const EXPENSE_CATEGORIES = [
  'food', 'transport', 'health', 'education', 'leisure', 'housing', 'other_expense',
] as const;

export const INCOME_CATEGORIES = [
  'salary', 'freelance', 'gift', 'other_income',
] as const;

export const useTransactions = (filter?: { type?: TransactionType; accountId?: string | null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const cacheKey = `transactions-${user?.id}-${filter?.type ?? 'all'}-${filter?.accountId ?? 'all'}`;
  const balanceCacheKey = `balance-${user?.id}-${filter?.accountId ?? 'all'}`;

  const transactionsQuery = useQuery({
    queryKey: ['transactions', user?.id, filter?.type, filter?.accountId],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = await cacheGet<Transaction[]>(cacheKey);
        return cached ?? [];
      }

      let query = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter?.accountId) {
        // When viewing a specific account (own or shared), filter by account_id only — RLS handles access
        query = query.eq('account_id', filter.accountId);
      } else {
        // No account selected: show only personal transactions
        query = query.eq('user_id', user!.id);
      }
      if (filter?.type) {
        query = query.eq('type', filter.type);
      }

      const { data, error } = await query;
      if (error) throw error;
      const result = data as Transaction[];

      // Cache for offline use
      cacheSet(cacheKey, result).catch(console.error);

      return result;
    },
    enabled: !!user,
  });

  const balanceQuery = useQuery({
    queryKey: ['balance', user?.id, filter?.accountId],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = await cacheGet<{ income: number; expense: number; balance: number }>(balanceCacheKey);
        return cached ?? { income: 0, expense: 0, balance: 0 };
      }

      let query = supabase
        .from('transactions')
        .select('type, amount');
      if (filter?.accountId) {
        query = query.eq('account_id', filter.accountId);
      } else {
        query = query.eq('user_id', user!.id);
      }
      const { data, error } = await query;
      if (error) throw error;

      let income = 0;
      let expense = 0;
      (data as Pick<Transaction, 'type' | 'amount'>[]).forEach((t) => {
        if (t.type === 'income') income += Number(t.amount);
        else expense += Number(t.amount);
      });
      const result = { income, expense, balance: income - expense };

      cacheSet(balanceCacheKey, result).catch(console.error);

      return result;
    },
    enabled: !!user,
  });

  const addTransaction = useMutation({
    mutationFn: async (tx: TransactionInsert & { account_id?: string }) => {
      if (!navigator.onLine) {
        // Queue for later sync
        const offlineTx = { ...tx, user_id: user!.id };
        await addToSyncQueue({ table: 'transactions', type: 'insert', payload: offlineTx });

        // Optimistic: update local cache
        const cached = await cacheGet<Transaction[]>(cacheKey) ?? [];
        const fakeTx: Transaction = {
          id: crypto.randomUUID(),
          user_id: user!.id,
          type: tx.type,
          amount: tx.amount,
          category: tx.category,
          description: tx.description ?? null,
          transaction_date: tx.transaction_date ?? new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
          _offline: true,
        };
        await cacheSet(cacheKey, [fakeTx, ...cached]);

        // Update balance cache
        const bal = await cacheGet<{ income: number; expense: number; balance: number }>(balanceCacheKey) ?? { income: 0, expense: 0, balance: 0 };
        if (tx.type === 'income') bal.income += tx.amount;
        else bal.expense += tx.amount;
        bal.balance = bal.income - bal.expense;
        await cacheSet(balanceCacheKey, bal);

        return fakeTx;
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...tx, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['global-balance-personal'] });
      queryClient.invalidateQueries({ queryKey: ['global-balance-shared'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (tx: Transaction) => {
      if (!navigator.onLine) {
        await addToSyncQueue({ table: 'transactions', type: 'delete', payload: { id: tx.id } });
        
        const cached = await cacheGet<Transaction[]>(cacheKey) ?? [];
        await cacheSet(cacheKey, cached.filter(t => t.id !== tx.id));
        return;
      }

      // If it's a transfer, find and delete the mirror transaction
      if (tx.category === 'transfer') {
        const mirrorType = tx.type === 'expense' ? 'income' : 'expense';
        const { data: mirror } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user!.id)
          .eq('category', 'transfer')
          .eq('type', mirrorType)
          .eq('amount', tx.amount)
          .eq('transaction_date', tx.transaction_date)
          .eq('description', tx.description ?? '')
          .limit(1)
          .maybeSingle();

        if (mirror) {
          await supabase.from('transactions').delete().eq('id', mirror.id);
        }
      }

      const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['global-balance-personal'] });
      queryClient.invalidateQueries({ queryKey: ['global-balance-shared'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
      queryClient.invalidateQueries({ queryKey: ['savings_deposits'] });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TransactionInsert> & { id: string }) => {
      if (!navigator.onLine) {
        await addToSyncQueue({ table: 'transactions', type: 'update', payload: { id, ...updates } });

        const cached = await cacheGet<Transaction[]>(cacheKey) ?? [];
        await cacheSet(cacheKey, cached.map(t => t.id === id ? { ...t, ...updates, _offline: true } : t));
        return { id, ...updates };
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user!.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['global-balance-personal'] });
      queryClient.invalidateQueries({ queryKey: ['global-balance-shared'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
    },
  });

  return {
    transactions: transactionsQuery.data ?? [],
    isLoading: transactionsQuery.isLoading,
    balance: balanceQuery.data ?? { income: 0, expense: 0, balance: 0 },
    addTransaction,
    deleteTransaction,
    updateTransaction,
  };
};
