import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useActiveAccountStore } from '@/stores/useActiveAccountStore';
import { cacheGet, cacheSet } from '@/lib/offlineDb';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
  sort_order: number;
  // Shared account fields
  shared?: boolean;
  sharedRole?: 'viewer' | 'editor';
  owner_name?: string;
}

export interface AccountMember {
  id: string;
  account_id: string;
  user_id: string;
  granted_by: string;
  role: string;
  created_at: string;
}

export function useAccounts() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const activeAccountId = useActiveAccountStore((s) => s.activeAccountId);
  const setActiveAccountId = useActiveAccountStore((s) => s.setActiveAccountId);

  const cacheKey = `accounts-${user?.id}`;

  // Fetch own accounts
  const { data: ownAccounts = [], isLoading: ownLoading } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: async () => {
      if (!navigator.onLine) {
        const cached = await cacheGet<Account[]>(cacheKey);
        return cached ?? [];
      }
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user!.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      const result = data as Account[];
      cacheSet(cacheKey, result).catch(console.error);
      return result;
    },
    enabled: !!user?.id,
  });

  // Fetch shared accounts (where user is a member)
  const { data: sharedAccountsData = [], isLoading: sharedLoading } = useQuery({
    queryKey: ['account-members', user?.id],
    queryFn: async () => {
      // Get account_members entries for this user
      const { data: memberships, error: memErr } = await supabase
        .from('account_members')
        .select('*')
        .eq('user_id', user!.id);
      if (memErr) throw memErr;
      if (!memberships || memberships.length === 0) return [];

      const accountIds = memberships.map(m => m.account_id);
      
      // Fetch the actual accounts
      const { data: accounts, error: accErr } = await supabase
        .from('accounts')
        .select('*')
        .in('id', accountIds);
      if (accErr) throw accErr;

      // Fetch owner profiles
      const ownerIds = [...new Set((accounts || []).map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ownerIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name || 'Utilisateur']));

      // Merge with membership info
      return (accounts || []).map(acc => {
        const membership = memberships.find(m => m.account_id === acc.id);
        return {
          ...acc,
          shared: true,
          sharedRole: (membership?.role || 'viewer') as 'viewer' | 'editor',
          owner_name: profileMap.get(acc.user_id) || 'Utilisateur',
        } as Account;
      });
    },
    enabled: !!user?.id,
  });

  // Merge own + shared
  const accounts = [...ownAccounts, ...sharedAccountsData];
  const isLoading = ownLoading || sharedLoading;

  // Auto-select default account if none selected
  useEffect(() => {
    if (accounts.length > 0 && (!activeAccountId || !accounts.find(a => a.id === activeAccountId))) {
      const defaultAcc = accounts.find(a => a.is_default && !a.shared) || accounts[0];
      setActiveAccountId(defaultAcc.id);
    }
  }, [accounts, activeAccountId, setActiveAccountId]);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0] || null;

  const switchAccount = useCallback((accountId: string) => {
    setActiveAccountId(accountId);
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['balance'] });
    queryClient.invalidateQueries({ queryKey: ['global-balance-personal'] });
    queryClient.invalidateQueries({ queryKey: ['global-balance-shared'] });
    queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
    queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
  }, [queryClient, setActiveAccountId]);

  const addAccount = useMutation({
    mutationFn: async (data: { name: string; icon?: string; color?: string; initialBalance?: number }) => {
      const { data: result, error } = await supabase
        .from('accounts')
        .insert({ user_id: user!.id, name: data.name, icon: data.icon || 'wallet', color: data.color || '#6366f1' })
        .select()
        .single();
      if (error) throw error;

      if (data.initialBalance && data.initialBalance > 0) {
        await supabase.from('transactions').insert({
          user_id: user!.id,
          account_id: result.id,
          type: 'income' as const,
          category: 'solde_initial',
          description: 'Solde de départ',
          amount: data.initialBalance,
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      toast.success(t('accounts.created'));
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; icon?: string; color?: string }) => {
      const { error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('transactions').delete().eq('account_id', id).eq('user_id', user!.id);
      await supabase.from('savings_goals').delete().eq('account_id', id).eq('user_id', user!.id);
      await supabase.from('recurring_transactions').delete().eq('account_id', id).eq('user_id', user!.id);
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      if (activeAccountId === deletedId) {
        setActiveAccountId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
      toast.success(t('accounts.deleted'));
    },
    onError: () => {
      toast.error(t('accounts.delete_error'));
    },
  });

  const reorderAccounts = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('accounts').update({ sort_order: index + 1 }).eq('id', id).eq('user_id', user!.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  // Account member management
  const addAccountMember = useMutation({
    mutationFn: async ({ accountId, userId, role }: { accountId: string; userId: string; role: 'viewer' | 'editor' }) => {
      const { error } = await supabase
        .from('account_members')
        .upsert({ account_id: accountId, user_id: userId, granted_by: user!.id, role }, { onConflict: 'account_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-members'] });
    },
  });

  const removeAccountMember = useMutation({
    mutationFn: async ({ accountId, userId }: { accountId: string; userId: string }) => {
      const { error } = await supabase
        .from('account_members')
        .delete()
        .eq('account_id', accountId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-members'] });
    },
  });

  // Get members for a specific account (owner view)
  const getAccountMembers = useCallback(async (accountId: string) => {
    const { data, error } = await supabase
      .from('account_members')
      .select('*')
      .eq('account_id', accountId);
    if (error) throw error;
    return (data || []) as AccountMember[];
  }, []);

  return {
    accounts,
    ownAccounts,
    sharedAccounts: sharedAccountsData,
    isLoading,
    activeAccount,
    activeAccountId,
    switchAccount,
    addAccount,
    updateAccount,
    deleteAccount,
    reorderAccounts,
    addAccountMember,
    removeAccountMember,
    getAccountMembers,
  };
}
